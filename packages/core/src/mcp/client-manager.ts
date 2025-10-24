import {
	Connection,
	McpClient,
	StreamableHttpClientTransport,
	type ToolCallResult,
} from "mcp-lite";
import type {
	McpServer,
	PromotedTool,
	Tool,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger";

/**
 * Custom error for OAuth authentication requirements
 */
export class OAuthRequiredError extends Error {
	constructor(
		public authUrl: string,
		message: string,
	) {
		super(message);
		this.name = "OAuthRequiredError";
	}
}

/**
 * Fetch OAuth information from server's well-known endpoints
 */
export interface OAuthDiscovery {
	authorization_endpoint: string;
	token_endpoint: string;
	registration_endpoint?: string;
}

export async function fetchOAuthDiscovery(
	serverUrl: string,
): Promise<OAuthDiscovery | null> {
	try {
		// Remove /mcp suffix if present
		const baseUrl = serverUrl.replace(/\/mcp\/?$/, "");

		// Try OAuth Authorization Server discovery
		const discoveryUrl = `${baseUrl}/.well-known/oauth-authorization-server`;
		logger.debug("Fetching OAuth discovery", { url: discoveryUrl });

		const response = await fetch(discoveryUrl);
		if (response.ok) {
			const data = (await response.json()) as Record<string, unknown>;
			if (
				data.authorization_endpoint &&
				typeof data.authorization_endpoint === "string" &&
				data.token_endpoint &&
				typeof data.token_endpoint === "string"
			) {
				logger.info("Found OAuth endpoints", {
					authUrl: data.authorization_endpoint,
					tokenUrl: data.token_endpoint,
					hasRegistration: !!data.registration_endpoint,
				});
				return {
					authorization_endpoint: data.authorization_endpoint,
					token_endpoint: data.token_endpoint,
					registration_endpoint:
						typeof data.registration_endpoint === "string"
							? data.registration_endpoint
							: undefined,
				};
			}
		}
	} catch (error) {
		logger.debug("Failed to fetch OAuth discovery", { error: String(error) });
	}

	return null;
}

export async function registerOAuthClient(
	registrationEndpoint: string,
	redirectUri: string,
): Promise<{ clientId: string; clientSecret?: string } | null> {
	try {
		logger.info("Registering OAuth client via DCR", {
			registrationEndpoint,
			redirectUri,
		});

		const response = await fetch(registrationEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				client_name: "MCP Gateway",
				redirect_uris: [redirectUri],
				grant_types: ["authorization_code"],
				response_types: ["code"],
				token_endpoint_auth_method: "none", // Public client (no secret needed for PKCE)
			}),
		});

		if (!response.ok) {
			logger.error("DCR registration failed", {
				status: response.status,
				statusText: response.statusText,
			});
			return null;
		}

		const data = (await response.json()) as Record<string, unknown>;
		if (data.client_id && typeof data.client_id === "string") {
			logger.info("DCR registration successful", {
				clientId: data.client_id,
				hasSecret: !!data.client_secret,
			});
			return {
				clientId: data.client_id,
				clientSecret:
					typeof data.client_secret === "string"
						? data.client_secret
						: undefined,
			};
		}

		logger.error("DCR response missing client_id", { data });
		return null;
	} catch (error) {
		logger.error("DCR registration error", { error: String(error) });
		return null;
	}
}

async function fetchOAuthInfo(
	serverUrl: string,
): Promise<{ authUrl: string; message?: string } | null> {
	const discovery = await fetchOAuthDiscovery(serverUrl);
	if (discovery) {
		return {
			authUrl: discovery.authorization_endpoint,
			message: "OAuth authentication required",
		};
	}

	return null;
}

/**
 * Extract OAuth information from an error
 * Returns null if not an OAuth error
 */
function extractOAuthInfo(
	error: unknown,
): { authUrl: string; message?: string } | null {
	logger.debug("Attempting to extract OAuth info from error", {
		errorType: typeof error,
		errorConstructor: error?.constructor?.name,
		errorKeys: error && typeof error === "object" ? Object.keys(error) : [],
	});

	// Check if error has response data
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		logger.debug("Error message content", { message: error.message });

		// Try to parse error message for auth_url in various formats
		try {
			// Pattern 1: JSON with auth_url field
			const jsonMatch = error.message.match(/\{[^}]*"auth_url"\s*:\s*"([^"]+)"/);
			if (jsonMatch?.[1]) {
				logger.info("Found auth_url via JSON pattern", { authUrl: jsonMatch[1] });
				return {
					authUrl: jsonMatch[1],
					message: error.message,
				};
			}

			// Pattern 2: auth_url without quotes
			const simpleMatch = error.message.match(/auth_url[:\s]+([^\s,}]+)/);
			if (simpleMatch?.[1]) {
				logger.info("Found auth_url via simple pattern", {
					authUrl: simpleMatch[1],
				});
				return {
					authUrl: simpleMatch[1],
					message: error.message,
				};
			}

			// Pattern 3: Try to parse entire message as JSON
			try {
				const parsed = JSON.parse(error.message);
				if (parsed.auth_url) {
					logger.info("Found auth_url via full JSON parse", {
						authUrl: parsed.auth_url,
					});
					return {
						authUrl: parsed.auth_url,
						message: error.message,
					};
				}
			} catch {
				// Not valid JSON, continue
			}
		} catch (parseError) {
			logger.debug("Failed to parse auth_url from error", { parseError });
		}
	}

	logger.debug("No OAuth info found in error");
	return null;
}

// Infer result types from Connection methods
type ListResourcesResult = Awaited<ReturnType<Connection["listResources"]>>;
type ResourceReadResult = Awaited<ReturnType<Connection["readResource"]>>;
type ListPromptsResult = Awaited<ReturnType<Connection["listPrompts"]>>;
type PromptGetResult = Awaited<ReturnType<Connection["getPrompt"]>>;

/**
 * Connection info stored for each server
 */
interface ConnectionInfo {
	client: McpClient;
	connection: Connection;
	transport: StreamableHttpClientTransport;
}

/**
 * ClientManager manages McpClient connections to downstream MCP servers.
 * This provides an alternative to the HTTP proxy approach, allowing direct
 * MCP protocol communication with servers.
 *
 * Key features:
 * - Manages persistent connections to MCP servers
 * - Supports tool calls, resource access, and prompt retrieval
 * - Applies description overrides from promotions for optimized tools
 * - Handles connection lifecycle and error recovery
 */
export class ClientManager {
	private connections: Map<string, ConnectionInfo> = new Map();

	/**
	 * Connect to an MCP server and establish a session
	 * @throws {OAuthRequiredError} if server requires OAuth authentication
	 */
	async connectServer(server: McpServer): Promise<Connection> {
		if (this.connections.has(server.name)) {
			logger.debug("Already connected to server", { serverName: server.name });
			return this.connections.get(server.name)!.connection;
		}

		logger.info("Connecting to MCP server via client", {
			serverName: server.name,
			url: server.url,
			hasAuthHeader: !!server.headers.Authorization,
		});

		try {
			// Create client
			const client = new McpClient({
				name: "mcp-gateway",
				version: "1.0.0",
			});

			// Create transport and bind to client
			const transport = new StreamableHttpClientTransport();
			const connect = transport.bind(client);

			// Connect to server with custom headers (including Authorization if present)
			const connection = await connect(server.url, {
				headers: server.headers,
			});

			// Store connection info
			this.connections.set(server.name, {
				client,
				connection,
				transport,
			});

			logger.info("Successfully connected to MCP server", {
				serverName: server.name,
			});

			return connection;
		} catch (error) {
			// Log the full error object for debugging
			logger.debug("Connection error details", {
				serverName: server.name,
				errorString: String(error),
				errorJSON: JSON.stringify(error, Object.getOwnPropertyNames(error)),
			});

			// Check if this is a 401 error - we need to fetch auth info
			if (
				error &&
				typeof error === "object" &&
				"message" in error &&
				typeof error.message === "string" &&
				error.message.includes("401")
			) {
				logger.info("Detected 401 error, fetching OAuth details", {
					serverName: server.name,
				});

				// Try to fetch OAuth discovery document
				const oauthInfo = await fetchOAuthInfo(server.url);
				if (oauthInfo) {
					logger.info("Server requires OAuth authentication", {
						serverName: server.name,
						authUrl: oauthInfo.authUrl,
					});
					throw new OAuthRequiredError(
						oauthInfo.authUrl,
						oauthInfo.message || "Authentication required",
					);
				}
			}

			// Check if this is an OAuth error from response body
			const oauthInfo = extractOAuthInfo(error);
			if (oauthInfo) {
				logger.info("Server requires OAuth authentication", {
					serverName: server.name,
					authUrl: oauthInfo.authUrl,
				});
				throw new OAuthRequiredError(
					oauthInfo.authUrl,
					oauthInfo.message || "Authentication required",
				);
			}

			// Re-throw other errors
			throw error;
		}
	}

	/**
	 * Discover tools from a server (used during initial connection)
	 */
	async discoverTools(serverName: string): Promise<Tool[]> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Discovering tools from server", { serverName });

		const result = await info.connection.listTools();
		const tools: Tool[] = result.tools.map((tool) => ({
			name: tool.name,
			description: tool.description || "",
			inputSchema: tool.inputSchema,
		}));

		logger.debug("Discovered tools", {
			serverName,
			toolCount: tools.length,
		});

		return tools;
	}

	/**
	 * Call a tool on a server
	 */
	async callTool(
		serverName: string,
		toolName: string,
		args: unknown,
	): Promise<ToolCallResult> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Calling tool via MCP client", {
			serverName,
			toolName,
		});

		const result = await info.connection.callTool(toolName, args);

		return result;
	}

	/**
	 * List tools from a server, optionally applying description overrides from promotions
	 */
	async listTools(
		serverName: string,
		promotions?: Map<string, PromotedTool>,
	): Promise<Tool[]> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Listing tools from server", {
			serverName,
			withPromotions: !!promotions,
		});

		const result = await info.connection.listTools();
		const tools: Tool[] = result.tools.map((tool) => {
			// Check if there's a promotion for this tool
			const promotion = promotions?.get(tool.name);
			if (promotion) {
				logger.debug("Applying promoted description", {
					serverName,
					toolName: tool.name,
					originalLength: tool.description?.length || 0,
					promotedLength: promotion.description.length,
				});

				return {
					name: tool.name,
					description: promotion.description,
					inputSchema: tool.inputSchema,
				};
			}

			return {
				name: tool.name,
				description: tool.description || "",
				inputSchema: tool.inputSchema,
			};
		});

		return tools;
	}

	/**
	 * List resources from a server
	 */
	async listResources(
		serverName: string,
	): Promise<ListResourcesResult["resources"]> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Listing resources from server", { serverName });

		const result = await info.connection.listResources();
		return result.resources;
	}

	/**
	 * Read a resource from a server
	 */
	async readResource(
		serverName: string,
		uri: string,
	): Promise<ResourceReadResult> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Reading resource from server", {
			serverName,
			uri,
		});

		const result = await info.connection.readResource(uri);

		return result;
	}

	/**
	 * List prompts from a server
	 */
	async listPrompts(serverName: string): Promise<ListPromptsResult["prompts"]> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Listing prompts from server", { serverName });

		const result = await info.connection.listPrompts();
		return result.prompts;
	}

	/**
	 * Get a prompt from a server
	 */
	async getPrompt(
		serverName: string,
		name: string,
		args?: unknown,
	): Promise<PromptGetResult> {
		const info = this.connections.get(serverName);
		if (!info) {
			throw new Error(`Not connected to server: ${serverName}`);
		}

		logger.debug("Getting prompt from server", {
			serverName,
			promptName: name,
		});

		const result = await info.connection.getPrompt(name, args);

		return result;
	}

	/**
	 * Disconnect from a server
	 */
	async disconnectServer(serverName: string): Promise<void> {
		const info = this.connections.get(serverName);
		if (!info) {
			logger.debug("Server not connected, nothing to disconnect", {
				serverName,
			});
			return;
		}

		logger.info("Disconnecting from MCP server", { serverName });

		try {
			await info.connection.close();
		} catch (error) {
			logger.warn("Error disconnecting from server", {
				serverName,
				error: String(error),
			});
		} finally {
			this.connections.delete(serverName);
		}
	}

	/**
	 * Check if connected to a server
	 */
	isConnected(serverName: string): boolean {
		return this.connections.has(serverName);
	}

	/**
	 * Disconnect all servers
	 */
	async disconnectAll(): Promise<void> {
		logger.info("Disconnecting all servers", {
			count: this.connections.size,
		});

		const disconnectPromises = Array.from(this.connections.keys()).map(
			(serverName) => this.disconnectServer(serverName),
		);

		await Promise.allSettled(disconnectPromises);
	}
}

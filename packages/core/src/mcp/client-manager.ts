import {
	Connection,
	McpClient,
	StreamableHttpClientTransport,
	StandardOAuthProvider,
	type OAuthConfig,
	type ToolCallResult,
} from "mcp-lite";
import type {
	McpServer,
	PromotedTool,
	Registry,
	Tool,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger.js";
import { GatewayOAuthAdapter } from "./oauth-adapter.js";
import { saveRegistry } from "../registry/storage.js";

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
 * - OAuth authentication using mcp-lite's built-in infrastructure
 */
export class ClientManager {
	private connections: Map<string, ConnectionInfo> = new Map();
	private oauthAdapter: GatewayOAuthAdapter;
	private oauthProvider: StandardOAuthProvider;
	private gatewayPort: number;
	private oauthStateToServer: Map<string, string> = new Map(); // state -> serverUrl
	private pendingOAuthTransports: Map<string, StreamableHttpClientTransport> =
		new Map(); // serverName -> transport

	constructor(
		private registry: Registry,
		private storageDir: string,
		gatewayPort: number,
		private onRegistryUpdate?: () => void,
	) {
		this.gatewayPort = gatewayPort;
		this.oauthAdapter = new GatewayOAuthAdapter(registry, storageDir);
		this.oauthProvider = new StandardOAuthProvider();
	}

	/**
	 * Connect to an MCP server and establish a session
	 * Uses mcp-lite's OAuth infrastructure for authentication
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
			hasOAuthToken: !!server.oauthToken,
			oauthTokenExpiresAt: server.oauthTokenExpiresAt,
			hasOAuthClientId: !!server.oauthClientId,
		});

		// Create client
		const client = new McpClient({
			name: "mcp-gateway",
			version: "1.0.0",
		});

		// Configure OAuth for this server
		const oauthConfig: OAuthConfig = {
			clientId: server.oauthClientId, // Optional - DCR will be used if not provided
			clientName: "MCP Gateway", // Used for Dynamic Client Registration
			redirectUri: `http://localhost:${this.gatewayPort}/oauth/callback`,
			onAuthorizationRequired: (authUrl) => {
				logger.info("OAuth authorization required (callback triggered)", {
					serverName: server.name,
					authUrl,
					gatewayPort: this.gatewayPort,
				});

				// Extract state from authorization URL and store mapping for callback
				try {
					const url = new URL(authUrl);
					const state = url.searchParams.get("state");
					if (state) {
						this.oauthStateToServer.set(state, server.url);
						logger.debug("Stored OAuth state mapping", {
							state,
							serverUrl: server.url,
							serverName: server.name,
						});
					}
				} catch (err) {
					logger.error("Failed to parse authorization URL", {
						authUrl,
						error: String(err),
					});
				}

				// Store auth URL in registry for TUI
				server.authUrl = authUrl;
				saveRegistry(this.storageDir, this.registry).catch((err) =>
					logger.error("Failed to save auth URL", { error: String(err) }),
				);

				if (this.onRegistryUpdate) {
					logger.debug("Triggering registry update callback");
					this.onRegistryUpdate();
				}
			},
		};

		logger.debug("Creating transport with OAuth config", {
			serverName: server.name,
			clientId: oauthConfig.clientId || "DCR (will auto-register)",
			clientName: oauthConfig.clientName,
			redirectUri: oauthConfig.redirectUri,
			hasOAuthAdapter: !!this.oauthAdapter,
			hasOAuthProvider: !!this.oauthProvider,
		});

		// Create transport with OAuth support
		const transport = new StreamableHttpClientTransport({
			oauthAdapter: this.oauthAdapter,
			oauthProvider: this.oauthProvider,
			oauthConfig,
		});

		// Store transport for potential OAuth callback before attempting connection
		this.pendingOAuthTransports.set(server.name, transport);

		const connect = transport.bind(client);

		try {
			logger.debug("Attempting connection", {
				serverName: server.name,
				url: server.url,
				headers: Object.keys(server.headers),
				willUseDCR: !oauthConfig.clientId,
			});

			// Connect to server with custom headers
			// mcp-lite will handle OAuth discovery and DCR automatically
			const connection = await connect(server.url, {
				headers: server.headers,
			});

			// Store connection info
			this.connections.set(server.name, {
				client,
				connection,
				transport,
			});

			// Remove from pending since connection succeeded
			this.pendingOAuthTransports.delete(server.name);

			logger.info("Successfully connected to MCP server", {
				serverName: server.name,
			});

			return connection;
		} catch (error) {
			logger.error("Failed to connect to MCP server", {
				serverName: server.name,
				error: String(error),
				errorStack: error instanceof Error ? error.stack : undefined,
				errorType: typeof error,
				errorConstructor: error?.constructor?.name,
			});

			// Keep transport in pendingOAuthTransports for OAuth callback
			// It will be cleaned up after OAuth completion or explicit disconnect

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
			// Still clean up any pending OAuth transport
			this.pendingOAuthTransports.delete(serverName);
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
			this.pendingOAuthTransports.delete(serverName);
		}
	}

	/**
	 * Check if connected to a server
	 */
	isConnected(serverName: string): boolean {
		return this.connections.has(serverName);
	}

	/**
	 * Get transport for a server (used for OAuth callback handling)
	 * Checks both established connections and pending OAuth transports
	 */
	getTransport(serverName: string): StreamableHttpClientTransport | undefined {
		// First check established connections
		const info = this.connections.get(serverName);
		if (info) {
			return info.transport as StreamableHttpClientTransport;
		}

		// Then check pending OAuth transports
		return this.pendingOAuthTransports.get(serverName);
	}

	/**
	 * Get list of connected server names
	 */
	getConnectedServers(): string[] {
		return Array.from(this.connections.keys());
	}

	/**
	 * Get server URL by OAuth state parameter
	 * Used in OAuth callback to determine which server initiated the flow
	 */
	getServerUrlByState(state: string): string | undefined {
		return this.oauthStateToServer.get(state);
	}

	/**
	 * Complete OAuth authorization flow for a server
	 * Looks up the server by state and calls the transport's completeAuthorizationFlow
	 */
	async completeOAuthFlow(
		code: string,
		state: string,
	): Promise<{ serverName: string; serverUrl: string }> {
		const serverUrl = this.getServerUrlByState(state);
		if (!serverUrl) {
			throw new Error(
				`No server found for OAuth state: ${state}. The authorization may have expired or been initiated from a different gateway instance.`,
			);
		}

		// Find server name from URL
		const server = this.registry.servers.find((s) => s.url === serverUrl);
		if (!server) {
			throw new Error(`Server not found in registry for URL: ${serverUrl}`);
		}

		logger.debug("Completing OAuth flow", {
			serverName: server.name,
			serverUrl,
			state,
		});

		// Get transport for this server
		const transport = this.getTransport(server.name);
		if (!transport) {
			throw new Error(
				`No transport found for server ${server.name}. Server may not have initiated an OAuth flow.`,
			);
		}

		// Complete the authorization flow
		await transport.completeAuthorizationFlow(serverUrl, code, state);

		// Clean up state mapping and pending transport
		this.oauthStateToServer.delete(state);
		this.pendingOAuthTransports.delete(server.name);

		logger.info("OAuth flow completed successfully", {
			serverName: server.name,
			serverUrl,
		});

		return { serverName: server.name, serverUrl };
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

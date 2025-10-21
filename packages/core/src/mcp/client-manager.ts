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
	 */
	async connectServer(server: McpServer): Promise<Connection> {
		if (this.connections.has(server.name)) {
			logger.debug("Already connected to server", { serverName: server.name });
			return this.connections.get(server.name)!.connection;
		}

		logger.info("Connecting to MCP server via client", {
			serverName: server.name,
			url: server.url,
		});

		// Create client
		const client = new McpClient({
			name: "mcp-gateway",
			version: "1.0.0",
		});

		// Create transport and bind to client
		const transport = new StreamableHttpClientTransport();
		const connect = transport.bind(client);

		// Connect to server
		const connection = await connect(server.url);

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

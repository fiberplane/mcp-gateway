import type {
  LogQueryOptions,
  LogQueryResult,
  McpServer,
  McpServerConfig,
  Registry,
} from "@fiberplane/mcp-gateway-types";

/**
 * Dependencies for server management tools
 *
 * Defines the interface for functions that server tools (add_server, remove_server, list_servers)
 * need to operate. This makes the dependencies explicit and testable without needing the full Gateway.
 *
 * All operations delegate to the storage layer which handles persistence internally.
 */
export interface ServerToolsDependencies {
  /**
   * Get all registered servers with current metrics
   */
  getRegisteredServers(): Promise<McpServer[]>;

  /**
   * Add a new server to the registry
   */
  addServer(server: McpServerConfig): Promise<void>;

  /**
   * Remove a server from the registry
   */
  removeServer(name: string): Promise<void>;
}

/**
 * Dependencies for capture analysis tools
 *
 * Defines the interface for functions that capture tools (search_records) need to operate.
 * This makes the dependencies explicit and testable without needing the full Gateway.
 */
export interface CaptureToolsDependencies {
  /**
   * Query captured logs with filtering and pagination
   */
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
}

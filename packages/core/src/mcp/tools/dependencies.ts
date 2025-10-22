import type {
  LogQueryOptions,
  LogQueryResult,
  Registry,
} from "@fiberplane/mcp-gateway-types";

/**
 * Dependencies for server management tools
 *
 * Defines the interface for functions that server tools (add_server, remove_server, list_servers)
 * need to operate. This makes the dependencies explicit and testable without needing the full Gateway.
 */
export interface ServerToolsDependencies {
  /**
   * Get server metrics (activity and request count) for a specific server
   */
  getServerMetrics(
    serverName: string,
  ): Promise<{ lastActivity: string | null; exchangeCount: number }>;

  /**
   * Persist registry changes to storage
   */
  saveRegistry(storageDir: string, registry: Registry): Promise<void>;
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

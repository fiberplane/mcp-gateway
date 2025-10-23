import type {
  ClientAggregation,
  LogQueryOptions,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "./logs.js";
import type { HealthStatus, McpServer, McpServerConfig } from "./registry.js";
import type { CaptureRecord } from "./schemas.js";

/**
 * Storage backend interface
 *
 * Allows different storage implementations (currently SQLite)
 * to be used for persisting MCP traffic captures.
 *
 * This is a full CRUD interface:
 * - write() for creating/updating records
 * - query() for reading/filtering records
 * - close() for cleanup
 */
export interface StorageBackend {
  /**
   * Backend name for logging/debugging
   */
  readonly name: string;

  /**
   * Write a capture record to storage
   *
   * @param record - The capture record to store
   * @returns Metadata about what was stored (optional)
   */
  write(record: CaptureRecord): Promise<StorageWriteResult>;

  /**
   * Query logs with filtering and pagination
   *
   * @param options - Query options (filters, pagination, sorting)
   * @returns Paginated query result with logs and metadata
   */
  queryLogs(options?: LogQueryOptions): Promise<LogQueryResult>;

  /**
   * Get server aggregations (name, log count, session count)
   *
   * @returns List of server aggregation info
   */
  getServers(): Promise<ServerInfo[]>;

  /**
   * Get session aggregations (session ID, server, log count, time range)
   *
   * @param serverName - Optional server filter
   * @returns List of session aggregation info
   */
  getSessions(serverName?: string): Promise<SessionInfo[]>;

  /**
   * Get client aggregations (client name/version, log count, session count)
   *
   * @returns List of client aggregation info
   */
  getClients(): Promise<ClientAggregation[]>;

  /**
   * Clear all logs from storage
   *
   * This is a destructive operation that removes all stored logs.
   * Use with caution.
   */
  clearAll(): Promise<void>;

  /**
   * Update server info for an initialize request after getting the response
   *
   * This backfills server metadata on the initialize request record,
   * which was captured before the response containing serverInfo was received.
   */
  updateServerInfoForInitializeRequest(
    serverName: string,
    sessionId: string,
    requestId: string | number,
    serverInfo: { name?: string; version: string; title?: string },
  ): Promise<void>;

  /**
   * Get session metadata by sessionId
   *
   * Returns client and server information for a specific session.
   * This metadata is persisted to SQLite and survives gateway restarts.
   *
   * @param sessionId - The session ID to retrieve metadata for
   * @returns Session metadata (client and server info) or null if not found
   */
  getSessionMetadata(sessionId: string): Promise<{
    client?: { name: string; version: string; title?: string };
    server?: { name?: string; version: string; title?: string };
  } | null>;

  /**
   * Get metrics for a specific server
   *
   * Returns activity metrics for a server computed from stored logs.
   * Used by MCP tools for server management operations.
   *
   * @param serverName - Name of the server to get metrics for
   * @returns Metrics including last activity timestamp and request count
   */
  getServerMetrics(
    serverName: string,
  ): Promise<{ lastActivity: string | null; exchangeCount: number }>;

  /**
   * Get all registered servers with computed metrics from logs
   *
   * Combines server configuration from mcp.json with activity metrics
   * computed from the logs database. Metrics are always calculated fresh
   * from the current logs state.
   *
   * @returns List of registered servers with full information and metrics
   */
  getRegisteredServers(): Promise<McpServer[]>;

  /**
   * Add a new server to the registry
   *
   * Creates a new server configuration in the registry. The server name
   * must be unique. Server metrics start at zero and are computed from
   * subsequent log entries.
   *
   * @param server - Server configuration to add (without metrics)
   * @throws Error if server name already exists
   */
  addServer(server: McpServerConfig): Promise<void>;

  /**
   * Remove a server from the registry
   *
   * Removes the server configuration. Associated logs are preserved for
   * historical analysis.
   *
   * @param name - Name of the server to remove
   * @throws Error if server doesn't exist
   */
  removeServer(name: string): Promise<void>;

  /**
   * Update server configuration
   *
   * Updates specific fields of a server's configuration. Only the provided
   * fields are updated; omitted fields are left unchanged.
   *
   * @param name - Name of the server to update
   * @param changes - Partial server configuration to apply
   * @throws Error if server doesn't exist
   */
  updateServer(
    name: string,
    changes: Partial<Omit<McpServerConfig, "name">>,
  ): Promise<void>;

  /**
   * Upsert server health status
   *
   * Updates the health status of a server in the database.
   * Used by health check manager to persist health status.
   *
   * @param serverName - Name of the server
   * @param health - Health status ("up" | "down" | "unknown")
   * @param lastCheck - ISO timestamp of the health check
   * @param url - Server URL
   */
  upsertServerHealth(
    serverName: string,
    health: HealthStatus,
    lastCheck: string,
    url: string,
  ): Promise<void>;

  /**
   * Close/cleanup the storage backend
   * Called on shutdown
   */
  close?(): Promise<void>;
}

/**
 * Result of a storage write operation
 */
export interface StorageWriteResult {
  /**
   * Optional metadata about what was written
   * (e.g., file path, database ID, etc.)
   */
  metadata?: Record<string, unknown>;
}

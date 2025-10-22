import type {
  CaptureRecord,
  ClientAggregation,
  LogQueryOptions,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";

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
   * Initialize the storage backend
   * Called once when the backend is registered
   */
  initialize(storageDir: string): Promise<void>;

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

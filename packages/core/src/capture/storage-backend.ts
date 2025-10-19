import type {
  CaptureRecord,
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

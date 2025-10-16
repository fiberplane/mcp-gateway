import type { CaptureRecord } from "@fiberplane/mcp-gateway-types";

/**
 * Storage backend interface
 *
 * Allows different storage implementations (JSONL, SQLite, etc.)
 * to be used independently or combined.
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

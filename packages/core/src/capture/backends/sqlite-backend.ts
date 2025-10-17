import type { CaptureRecord } from "@fiberplane/mcp-gateway-types";
import { logger } from "../../logger";
import type { StorageBackend, StorageWriteResult } from "../storage-backend.js";

/**
 * SQLite storage backend
 *
 * Writes capture records to SQLite database for fast querying
 * Lazily imports database modules to avoid circular dependencies
 */
export class SqliteStorageBackend implements StorageBackend {
  readonly name = "sqlite";
  private storageDir: string | null = null;
  private initialized = false;

  async initialize(storageDir: string): Promise<void> {
    this.storageDir = storageDir;

    try {
      // Lazy import to avoid circular dependencies
      const { getDb } = await import("../../logs/db.js");
      const { ensureMigrations } = await import("../../logs/migrations.js");

      const db = getDb(storageDir);
      await ensureMigrations(db);

      this.initialized = true;
      logger.debug("SQLite backend initialized", { storageDir });
    } catch (error) {
      logger.warn("SQLite backend initialization failed", {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : String(error),
      });
      // Don't throw - allow fallback to other backends
    }
  }

  async write(record: CaptureRecord): Promise<StorageWriteResult> {
    if (!this.storageDir || !this.initialized) {
      logger.debug("SQLite backend not ready, skipping write");
      return {
        metadata: {
          skipped: true,
          reason: "Backend not initialized",
        },
      };
    }

    try {
      // Lazy import to avoid circular dependencies
      const { getDb } = await import("../../logs/db.js");
      const { insertLog } = await import("../../logs/storage.js");

      const db = getDb(this.storageDir);
      await insertLog(db, record);

      return {
        metadata: {
          database: `${this.storageDir}/logs.db`,
        },
      };
    } catch (error) {
      logger.error("SQLite write failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: record.metadata.serverName,
      });

      // Don't throw - allow JSONL backend to succeed
      return {
        metadata: {
          error: true,
          reason: String(error),
        },
      };
    }
  }

  async close(): Promise<void> {
    // SQLite connections are managed by the db module
    logger.debug("SQLite backend closed");
  }
}

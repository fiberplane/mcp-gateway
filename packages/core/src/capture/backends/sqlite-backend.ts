import { Database } from "bun:sqlite";
import { join } from "node:path";
import type {
  CaptureRecord,
  ClientAggregation,
  LogQueryOptions,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { logger } from "../../logger";
import * as schema from "../../logs/schema.js";
import type { StorageBackend, StorageWriteResult } from "../storage-backend.js";

/**
 * SQLite storage backend
 *
 * Writes capture records to SQLite database for fast querying
 * Each instance owns its own DB connection (no global cache)
 */
export class SqliteStorageBackend implements StorageBackend {
  readonly name = "sqlite";
  private storageDir: string | null = null;
  private db: BunSQLiteDatabase<typeof schema> | null = null;
  private sqlite: Database | null = null;
  private initialized = false;

  async initialize(storageDir: string): Promise<void> {
    this.storageDir = storageDir;

    try {
      // Create DB connection (owned by this instance, not global cache)
      const dbPath = join(storageDir, "logs.db");
      this.sqlite = new Database(dbPath, { create: true });

      // Enable WAL mode for better concurrency (multiple readers, single writer)
      this.sqlite.exec("PRAGMA journal_mode = WAL;");

      // Set busy timeout to 5 seconds to wait for locks instead of failing immediately
      this.sqlite.exec("PRAGMA busy_timeout = 5000;");

      // Use NORMAL synchronous mode for better performance (WAL provides safety)
      this.sqlite.exec("PRAGMA synchronous = NORMAL;");

      this.db = drizzle(this.sqlite, { schema });

      // Run migrations
      const { ensureMigrations } = await import("../../logs/migrations.js");
      await ensureMigrations(this.db);

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
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, skipping write");
      return {
        metadata: {
          skipped: true,
          reason: "Backend not initialized",
        },
      };
    }

    try {
      // Use owned DB connection
      const { insertLog } = await import("../../logs/storage.js");
      await insertLog(this.db, record);

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

      // Don't throw - write failures shouldn't crash the gateway
      return {
        metadata: {
          error: true,
          reason: String(error),
        },
      };
    }
  }

  async queryLogs(options: LogQueryOptions = {}): Promise<LogQueryResult> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, returning empty result");
      return {
        data: [],
        pagination: {
          count: 0,
          limit: options.limit || 100,
          hasMore: false,
          oldestTimestamp: null,
          newestTimestamp: null,
        },
      };
    }

    try {
      const { queryLogs } = await import("../../logs/storage.js");
      return await queryLogs(this.db, options);
    } catch (error) {
      logger.error("SQLite queryLogs failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getServers(): Promise<ServerInfo[]> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, returning empty servers");
      return [];
    }

    try {
      const { getServers } = await import("../../logs/storage.js");
      return await getServers(this.db);
    } catch (error) {
      logger.error("SQLite getServers failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getSessions(serverName?: string): Promise<SessionInfo[]> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, returning empty sessions");
      return [];
    }

    try {
      const { getSessions } = await import("../../logs/storage.js");
      return await getSessions(this.db, serverName);
    } catch (error) {
      logger.error("SQLite getSessions failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getClients(): Promise<ClientAggregation[]> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, returning empty clients");
      return [];
    }

    try {
      const { getClients } = await import("../../logs/storage.js");
      return await getClients(this.db);
    } catch (error) {
      logger.error("SQLite getClients failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, skipping clearAll");
      return;
    }

    try {
      // Wrap all deletions in a transaction to ensure atomicity
      this.sqlite?.transaction(() => {
        // Delete all rows from the logs table
        this.sqlite?.run("DELETE FROM logs");
        // Delete all rows from session metadata table
        this.sqlite?.run("DELETE FROM session_metadata");
        // Reset auto-increment counter
        this.sqlite?.run("DELETE FROM sqlite_sequence WHERE name='logs'");
        this.sqlite?.run(
          "DELETE FROM sqlite_sequence WHERE name='session_metadata'",
        );
      })();
      logger.info("SQLite logs cleared");
    } catch (error) {
      logger.error("SQLite clearAll failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateServerInfoForInitializeRequest(
    serverName: string,
    sessionId: string,
    requestId: string | number,
    serverInfo: { name?: string; version: string; title?: string },
  ): Promise<void> {
    if (!this.db || !this.initialized) {
      logger.debug(
        "SQLite backend not ready, skipping updateServerInfoForInitializeRequest",
      );
      return;
    }

    try {
      const { updateServerInfoForInitializeRequest } = await import(
        "../../logs/storage.js"
      );
      await updateServerInfoForInitializeRequest(
        this.db,
        serverName,
        sessionId,
        requestId,
        serverInfo,
      );
      logger.debug("Server info backfilled for initialize request", {
        serverName,
        sessionId,
        requestId,
        serverInfo,
      });
    } catch (error) {
      logger.error("SQLite updateServerInfoForInitializeRequest failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName,
        sessionId,
        requestId,
      });
      throw error;
    }
  }

  async getSessionMetadata(sessionId: string): Promise<{
    client?: { name: string; version: string; title?: string };
    server?: { name?: string; version: string; title?: string };
  } | null> {
    if (!this.db || !this.initialized) {
      logger.debug(
        "SQLite backend not ready, returning null for session metadata",
      );
      return null;
    }

    try {
      const { getSessionMetadata } = await import("../../logs/storage.js");
      return await getSessionMetadata(this.db, sessionId);
    } catch (error) {
      logger.error("SQLite getSessionMetadata failed", {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      throw error;
    }
  }

  async getServerMetrics(
    serverName: string,
  ): Promise<{ lastActivity: string | null; exchangeCount: number }> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, returning empty metrics");
      return {
        lastActivity: null,
        exchangeCount: 0,
      };
    }

    try {
      const { getServerMetrics } = await import("../../logs/storage.js");
      return await getServerMetrics(this.db, serverName);
    } catch (error) {
      logger.error("SQLite getServerMetrics failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName,
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.sqlite) {
      try {
        this.sqlite.close();
        this.db = null;
        this.sqlite = null;
        this.initialized = false;
        logger.debug("SQLite backend closed", { storageDir: this.storageDir });
      } catch (error) {
        logger.warn("Error closing SQLite connection", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

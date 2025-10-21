import { Database } from "bun:sqlite";
import { join } from "node:path";
import type {
  CaptureRecord,
  LogQueryOptions,
  LogQueryResult,
  ServerHealth,
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

  async getServers(
    registryServers?: string[],
    serverHealthMap?: Map<string, ServerHealth>,
  ): Promise<ServerInfo[]> {
    if (!this.db || !this.initialized) {
      logger.debug("SQLite backend not ready, returning empty servers");
      return [];
    }

    try {
      const { getServers } = await import("../../logs/storage.js");
      return await getServers(this.db, registryServers, serverHealthMap);
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

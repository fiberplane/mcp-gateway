import { Database } from "bun:sqlite";
import { join } from "node:path";
import type {
  CaptureRecord,
  ClientAggregation,
  LogQueryOptions,
  LogQueryResult,
  McpServer,
  McpServerConfig,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { logger } from "../../logger";
import { ensureMigrations } from "../../logs/migrations.js";
import * as schema from "../../logs/schema.js";
import {
  getClients,
  getServerMetrics,
  getServers,
  getSessionMetadata,
  getSessions,
  insertLog,
  queryLogs,
  updateServerInfoForInitializeRequest,
} from "../../logs/storage.js";
import { loadRegistry, saveRegistry } from "../../registry/storage.js";
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
      return await getServerMetrics(this.db, serverName);
    } catch (error) {
      logger.error("SQLite getServerMetrics failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName,
      });
      throw error;
    }
  }

  async getRegisteredServers(): Promise<McpServer[]> {
    if (!this.storageDir) {
      throw new Error(
        "Storage directory not initialized. Call initialize() first.",
      );
    }

    try {
      // Load server configuration from mcp.json
      const registry = await loadRegistry(this.storageDir);

      // Enrich each server with computed metrics from database
      if (!this.db || !this.initialized) {
        // If database not ready, return config with zero metrics
        return registry.servers.map((server) => ({
          ...server,
          lastActivity: null,
          exchangeCount: 0,
        }));
      }

      // Get metrics for all servers
      const serversWithMetrics = await Promise.all(
        registry.servers.map(async (server) => {
          const metrics = await this.getServerMetrics(server.name);
          return { ...server, ...metrics };
        }),
      );

      return serversWithMetrics;
    } catch (error) {
      logger.error("SQLite getRegisteredServers failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async addServer(server: McpServerConfig): Promise<void> {
    if (!this.storageDir) {
      throw new Error(
        "Storage directory not initialized. Call initialize() first.",
      );
    }

    try {
      const registry = await loadRegistry(this.storageDir);

      // Check for duplicate server name
      if (registry.servers.some((s) => s.name === server.name)) {
        throw new Error(
          `Server '${server.name}' already exists in the registry`,
        );
      }

      // Add new server with zero metrics (will be computed from logs)
      registry.servers.push({
        ...server,
        lastActivity: null,
        exchangeCount: 0,
      });

      // Persist to file
      await saveRegistry(this.storageDir, registry);
      logger.debug("Server added to registry", { name: server.name });
    } catch (error) {
      logger.error("SQLite addServer failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: server.name,
      });
      throw error;
    }
  }

  async removeServer(name: string): Promise<void> {
    if (!this.storageDir) {
      throw new Error(
        "Storage directory not initialized. Call initialize() first.",
      );
    }

    try {
      const registry = await loadRegistry(this.storageDir);

      // Find server to remove
      const index = registry.servers.findIndex((s) => s.name === name);
      if (index === -1) {
        throw new Error(`Server '${name}' not found in the registry`);
      }

      // Remove server from registry
      registry.servers.splice(index, 1);

      // Persist to file (logs are preserved for historical analysis)
      await saveRegistry(this.storageDir, registry);
      logger.debug("Server removed from registry", { name });
    } catch (error) {
      logger.error("SQLite removeServer failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: name,
      });
      throw error;
    }
  }

  async updateServer(
    name: string,
    changes: Partial<Omit<McpServerConfig, "name">>,
  ): Promise<void> {
    if (!this.storageDir) {
      throw new Error(
        "Storage directory not initialized. Call initialize() first.",
      );
    }

    try {
      const registry = await loadRegistry(this.storageDir);

      // Find server to update
      const server = registry.servers.find((s) => s.name === name);
      if (!server) {
        throw new Error(`Server '${name}' not found in the registry`);
      }

      // Update the server's mutable fields (url, headers)
      if (changes.url !== undefined) {
        server.url = changes.url;
      }
      if (changes.headers !== undefined) {
        server.headers = changes.headers;
      }

      // Persist to file
      await saveRegistry(this.storageDir, registry);
      logger.debug("Server updated in registry", { name, changes });
    } catch (error) {
      logger.error("SQLite updateServer failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: name,
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

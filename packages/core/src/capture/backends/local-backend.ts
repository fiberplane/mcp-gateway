import { Database } from "bun:sqlite";
import { join } from "node:path";
import type {
  CaptureRecord,
  ClientAggregation,
  HealthStatus,
  LogQueryOptions,
  LogQueryResult,
  McpServer,
  McpServerConfig,
  ServerInfo,
  SessionInfo,
  StorageBackend,
  StorageWriteResult,
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
  upsertServerHealth,
} from "../../logs/storage.js";
import { loadRegistry, saveRegistry } from "../../registry/storage.js";

/**
 * Local file system storage backend
 *
 * Handles persistence using:
 * - SQLite database (logs.db) for MCP traffic capture logs
 * - JSON file (mcp.json) for server registry configuration
 *
 * Each instance owns its own DB connection (no global cache)
 */
export class LocalStorageBackend implements StorageBackend {
  readonly name = "local";
  private storageDir: string;
  private db: BunSQLiteDatabase<typeof schema>;
  private sqlite: Database;

  /**
   * Private constructor - use LocalStorageBackend.create() instead
   */
  private constructor(
    storageDir: string,
    db: BunSQLiteDatabase<typeof schema>,
    sqlite: Database,
  ) {
    this.storageDir = storageDir;
    this.db = db;
    this.sqlite = sqlite;
  }

  /**
   * Create and initialize a LocalStorageBackend instance
   *
   * This factory method ensures the database is fully initialized
   * (including migrations) before returning the instance.
   *
   * @param storageDir - Directory for storing logs and registry
   * @returns Fully initialized LocalStorageBackend instance
   * @throws Error if database initialization fails
   */
  static async create(storageDir: string): Promise<LocalStorageBackend> {
    const dbPath = join(storageDir, "logs.db");

    try {
      // Create database connection
      const sqlite = new Database(dbPath, { create: true });

      // Configure SQLite for performance and concurrency
      sqlite.exec("PRAGMA journal_mode = WAL;");
      sqlite.exec("PRAGMA busy_timeout = 5000;");
      sqlite.exec("PRAGMA synchronous = NORMAL;");

      // Create Drizzle instance
      const db = drizzle(sqlite, { schema });

      // Ensure migrations are applied before returning
      await ensureMigrations(db);

      logger.debug("LocalStorageBackend initialized successfully", {
        storageDir,
        dbPath,
      });

      return new LocalStorageBackend(storageDir, db, sqlite);
    } catch (error) {
      logger.error("Failed to initialize LocalStorageBackend", {
        storageDir,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : String(error),
      });
      throw error;
    }
  }

  async write(record: CaptureRecord): Promise<StorageWriteResult> {
    try {
      await insertLog(this.db, record);

      return {
        metadata: {
          database: `${this.storageDir}/logs.db`,
        },
      };
    } catch (error) {
      logger.error("Local storage write failed", {
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
    try {
      return await queryLogs(this.db, options);
    } catch (error) {
      logger.error("Local storage queryLogs failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getServers(): Promise<ServerInfo[]> {
    try {
      // Load registry to get registered server names
      const registry = await loadRegistry(this.storageDir);
      const registryServers = registry.servers.map((s) => s.name);

      // Health status is now read from the database by getServers()
      return await getServers(this.db, registryServers);
    } catch (error) {
      logger.error("Local storage getServers failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getSessions(serverName?: string): Promise<SessionInfo[]> {
    try {
      return await getSessions(this.db, serverName);
    } catch (error) {
      logger.error("Local storage getSessions failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getClients(): Promise<ClientAggregation[]> {
    try {
      return await getClients(this.db);
    } catch (error) {
      logger.error("Local storage getClients failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Wrap all deletions in a transaction to ensure atomicity
      this.sqlite.transaction(() => {
        this.sqlite.run("DELETE FROM logs");
        this.sqlite.run("DELETE FROM session_metadata");
        this.sqlite.run("DELETE FROM sqlite_sequence WHERE name='logs'");
        this.sqlite.run(
          "DELETE FROM sqlite_sequence WHERE name='session_metadata'",
        );
      })();
      logger.info("Local storage logs cleared");
    } catch (error) {
      logger.error("Local storage clearAll failed", {
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
      logger.error(
        "Local storage updateServerInfoForInitializeRequest failed",
        {
          error: error instanceof Error ? error.message : String(error),
          serverName,
          sessionId,
          requestId,
        },
      );
      throw error;
    }
  }

  async getSessionMetadata(sessionId: string): Promise<{
    client?: { name: string; version: string; title?: string };
    server?: { name?: string; version: string; title?: string };
  } | null> {
    try {
      return await getSessionMetadata(this.db, sessionId);
    } catch (error) {
      logger.error("Local storage getSessionMetadata failed", {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      throw error;
    }
  }

  async getServerMetrics(
    serverName: string,
  ): Promise<{ lastActivity: string | null; exchangeCount: number }> {
    try {
      return await getServerMetrics(this.db, serverName);
    } catch (error) {
      logger.error("Local storage getServerMetrics failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName,
      });
      throw error;
    }
  }

  async getRegisteredServers(): Promise<McpServer[]> {
    try {
      // Load server configuration from mcp.json
      const registry = await loadRegistry(this.storageDir);

      // Get metrics for all servers
      const serversWithMetrics = await Promise.all(
        registry.servers.map(async (server) => {
          const metrics = await this.getServerMetrics(server.name);
          return { ...server, ...metrics };
        }),
      );

      return serversWithMetrics;
    } catch (error) {
      logger.error("Local storage getRegisteredServers failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getServer(name: string): Promise<McpServer | undefined> {
    try {
      const servers = await this.getRegisteredServers();
      return servers.find((s) => s.name === name);
    } catch (error) {
      logger.error("Local storage getServer failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: name,
      });
      throw error;
    }
  }

  async addServer(server: McpServerConfig): Promise<void> {
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
      logger.error("Local storage addServer failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: server.name,
      });
      throw error;
    }
  }

  async removeServer(name: string): Promise<void> {
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
      logger.error("Local storage removeServer failed", {
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
      logger.error("Local storage updateServer failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName: name,
      });
      throw error;
    }
  }

  async upsertServerHealth(
    serverName: string,
    health: HealthStatus,
    lastCheck: string,
    url: string,
  ): Promise<void> {
    try {
      await upsertServerHealth(this.db, {
        serverName,
        health,
        lastCheck,
        url,
      });
      logger.debug("Server health updated", { serverName, health });
    } catch (error) {
      logger.error("Local storage upsertServerHealth failed", {
        error: error instanceof Error ? error.message : String(error),
        serverName,
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.sqlite.close();
      logger.debug("Local storage backend closed", {
        storageDir: this.storageDir,
      });
    } catch (error) {
      logger.warn("Error closing local storage connection", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
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
import { eq } from "drizzle-orm";
import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";
import Database from "libsql";
import { logger } from "../../logger";
import { ensureMigrations } from "../../logs/migrations.js";
import * as schema from "../../logs/schema.js";
import {
  getClients,
  getMethods,
  getServerMetrics,
  getServers,
  getSessionMetadata,
  getSessions,
  insertLog,
  queryLogs,
  updateServerInfoForInitializeRequest,
  upsertServerHealth,
} from "../../logs/storage.js";
import {
  ServerAlreadyExistsError,
  ServerNotFoundError,
} from "../../registry/errors";
import { fromMcpJson, toMcpJson } from "../../registry/index";
import { ensureStorageDir } from "../../utils/storage";
import { isValidUrl } from "../../utils/url";

/**
 * Local file system storage backend
 *
 * Handles persistence using:
 * - SQLite database (logs.db) for MCP traffic capture logs
 * - JSON file (mcp.json) for server registry configuration
 *
 * Each instance owns its own DB connection (no global cache)
 *
 * ⚠️ **Concurrency Limitation**: Registry modifications (addServer, removeServer,
 * updateServer) are NOT atomic across multiple processes. The read-modify-write
 * pattern used for mcp.json can lead to lost updates if multiple processes modify
 * the registry simultaneously.
 *
 * For single-user CLI usage, this is acceptable. For multi-process deployments,
 * consider implementing file locking or using a database-backed storage implementation.
 */
export class LocalStorageBackend implements StorageBackend {
  readonly name = "local";
  private storageDir: string;
  private db: BetterSQLite3Database<typeof schema>;
  private sqlite: ReturnType<typeof Database>;
  private inMemoryRegistry: McpServer[] = []; // For :memory: databases

  /**
   * Private constructor - use LocalStorageBackend.create() instead
   */
  private constructor(
    storageDir: string,
    db: BetterSQLite3Database<typeof schema>,
    sqlite: ReturnType<typeof Database>,
  ) {
    this.storageDir = storageDir;
    this.db = db;
    this.sqlite = sqlite;
  }

  /**
   * Load server list from mcp.json
   * @private Internal method for registry persistence
   */
  private async loadRegistry(): Promise<McpServer[]> {
    // Use in-memory registry for in-memory databases (tests)
    if (this.storageDir === ":memory:") {
      return this.inMemoryRegistry;
    }

    const mcpPath = join(this.storageDir, "mcp.json");

    try {
      await access(mcpPath, constants.F_OK);
    } catch {
      // File doesn't exist - this is normal for first run
      return [];
    }

    try {
      // Type assertion needed: Bun's readFile with "utf8" encoding returns string, not Buffer
      const content = (await readFile(mcpPath, "utf8")) as unknown as string;
      const data = JSON.parse(content);
      const servers = fromMcpJson(data);

      // Detect configuration that exists but has no valid servers
      if (
        servers.length === 0 &&
        Object.keys(data.mcpServers || {}).length > 0
      ) {
        logger.error("mcp.json exists but contains no valid servers", {
          path: mcpPath,
          serverCount: Object.keys(data.mcpServers || {}).length,
        });
      }

      return servers;
    } catch (error) {
      // Distinguish between parse errors and other errors
      if (error instanceof SyntaxError) {
        logger.error("mcp.json is not valid JSON", {
          path: mcpPath,
          error: error.message,
        });
      } else {
        logger.error("Failed to load mcp.json", {
          path: mcpPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return [];
    }
  }

  /**
   * Save server list to mcp.json
   * @private Internal method for registry persistence
   */
  private async saveRegistry(servers: McpServer[]): Promise<void> {
    // Use in-memory registry for in-memory databases (tests)
    if (this.storageDir === ":memory:") {
      this.inMemoryRegistry = servers;
      return;
    }

    await ensureStorageDir(this.storageDir);

    const mcpPath = join(this.storageDir, "mcp.json");
    const data = toMcpJson(servers);

    try {
      await writeFile(mcpPath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
      throw new Error(`Failed to save registry: ${error}`);
    }
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
    // Support in-memory database for tests
    const dbPath =
      storageDir === ":memory:" ? ":memory:" : join(storageDir, "logs.db");

    try {
      // Create database connection (libsql auto-creates)
      const sqlite = new Database(dbPath);

      // Configure SQLite for performance and concurrency
      sqlite.exec("PRAGMA journal_mode = WAL;");
      sqlite.exec("PRAGMA busy_timeout = 5000;");
      sqlite.exec("PRAGMA synchronous = NORMAL;");

      // Create Drizzle instance
      // Type assertion: libsql is better-sqlite3 compatible at runtime but has different types
      // @ts-expect-error - libsql and better-sqlite3 have compatible APIs but incompatible type definitions
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
      const servers = await this.loadRegistry();
      const registryServers = servers.map((s) => s.name);

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

  async getMethods(serverName?: string): Promise<Array<{ method: string }>> {
    try {
      return await getMethods(this.db, serverName);
    } catch (error) {
      logger.error("Local storage getMethods failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Wrap all deletions in a transaction to ensure atomicity
      this.sqlite.transaction(() => {
        this.sqlite.prepare("DELETE FROM logs").run();
        this.sqlite.prepare("DELETE FROM session_metadata").run();
        this.sqlite
          .prepare("DELETE FROM sqlite_sequence WHERE name='logs'")
          .run();
        this.sqlite
          .prepare("DELETE FROM sqlite_sequence WHERE name='session_metadata'")
          .run();
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
      const servers = await this.loadRegistry();

      // Get metrics and health for all servers
      const serversWithData = await Promise.all(
        servers.map(async (server) => {
          const metrics = await this.getServerMetrics(server.name);
          // Also load health status from database
          const healthResult = await this.db
            .select()
            .from(schema.serverHealth)
            .where(eq(schema.serverHealth.serverName, server.name))
            .limit(1);

          const healthData = healthResult[0];
          return {
            ...server,
            ...metrics,
            health: healthData?.health,
            lastHealthCheck: healthData?.lastCheck,
          };
        }),
      );

      return serversWithData;
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
      const servers = await this.loadRegistry();

      // Check for duplicate server name
      if (servers.some((s) => s.name === server.name)) {
        throw new ServerAlreadyExistsError(server.name);
      }

      // Add new server with zero metrics (will be computed from logs)
      servers.push({
        ...server,
        lastActivity: null,
        exchangeCount: 0,
      });

      // Persist to file
      await this.saveRegistry(servers);
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
      const servers = await this.loadRegistry();

      // Find server to remove
      const index = servers.findIndex((s) => s.name === name);
      if (index === -1) {
        throw new ServerNotFoundError(name);
      }

      // Remove server from registry
      servers.splice(index, 1);

      // Persist to file (logs are preserved for historical analysis)
      await this.saveRegistry(servers);
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
      const servers = await this.loadRegistry();

      // Find server to update
      const server = servers.find((s) => s.name === name);
      if (!server) {
        throw new ServerNotFoundError(name);
      }

      // Update the server's mutable fields (url, headers)
      if (changes.url !== undefined) {
        if (!isValidUrl(changes.url)) {
          throw new Error(`Invalid URL format: ${changes.url}`);
        }
        server.url = changes.url;
      }
      if (changes.headers !== undefined) {
        server.headers = changes.headers;
      }

      // Persist to file
      await this.saveRegistry(servers);
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

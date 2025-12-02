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
  StdioProcessState,
  StorageBackend,
  StorageWriteResult,
} from "@fiberplane/mcp-gateway-types";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
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
  UnsupportedServerUrlError,
} from "../../registry/errors";
import { fromMcpJson, toMcpJson } from "../../registry/index";
import { StdioSessionManager } from "../../subprocess/stdio-session-manager";
import { getErrorMessage } from "../../utils/error.js";
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
  private db: LibSQLDatabase<typeof schema>;
  private client: ReturnType<typeof createClient>;
  private inMemoryRegistry: McpServer[] = []; // For :memory: databases
  private stdioSessionManagers = new Map<string, StdioSessionManager>(); // Stdio session managers by server name

  /**
   * Private constructor - use LocalStorageBackend.create() instead
   */
  private constructor(
    storageDir: string,
    db: LibSQLDatabase<typeof schema>,
    client: ReturnType<typeof createClient>,
  ) {
    this.storageDir = storageDir;
    this.db = db;
    this.client = client;
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
      const content = await readFile(mcpPath, "utf8");
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
          error: getErrorMessage(error),
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
    // libsql requires "file::memory:" syntax (not ":memory:")
    // See: https://github.com/tursodatabase/libsql-client-ts
    const dbPath =
      storageDir === ":memory:"
        ? "file::memory:"
        : `file:${join(storageDir, "logs.db")}`;

    try {
      // Create database connection using @libsql/client
      const client = createClient({ url: dbPath });

      // Configure SQLite for performance and concurrency via PRAGMA statements
      await client.execute("PRAGMA journal_mode = WAL;");
      await client.execute("PRAGMA busy_timeout = 5000;");
      await client.execute("PRAGMA synchronous = NORMAL;");

      // Create Drizzle instance with proper libsql adapter
      const db = drizzle(client, { schema });

      // Ensure migrations are applied before returning
      await ensureMigrations(db);

      logger.debug("LocalStorageBackend initialized successfully", {
        storageDir,
        dbPath,
      });

      return new LocalStorageBackend(storageDir, db, client);
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
        error: getErrorMessage(error),
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
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getServers(): Promise<ServerInfo[]> {
    try {
      // Load registry to get registered server names and URLs
      const servers = await this.loadRegistry();
      const registryServers = servers.map((s) => ({
        name: s.name,
        url: s.type === "http" ? s.url : undefined,
      }));

      // Health status and URLs are returned by getServers()
      return await getServers(this.db, registryServers);
    } catch (error) {
      logger.error("Local storage getServers failed", {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getSessions(serverName?: string): Promise<SessionInfo[]> {
    try {
      return await getSessions(this.db, serverName);
    } catch (error) {
      logger.error("Local storage getSessions failed", {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getClients(): Promise<ClientAggregation[]> {
    try {
      return await getClients(this.db);
    } catch (error) {
      logger.error("Local storage getClients failed", {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getMethods(serverName?: string): Promise<Array<{ method: string }>> {
    try {
      return await getMethods(this.db, serverName);
    } catch (error) {
      logger.error("Local storage getMethods failed", {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Execute deletions in a transaction to ensure atomicity
      await this.client.batch([
        { sql: "DELETE FROM logs", args: [] },
        { sql: "DELETE FROM session_metadata", args: [] },
        { sql: "DELETE FROM sqlite_sequence WHERE name='logs'", args: [] },
        {
          sql: "DELETE FROM sqlite_sequence WHERE name='session_metadata'",
          args: [],
        },
      ]);
      logger.info("Local storage logs cleared");
    } catch (error) {
      logger.error("Local storage clearAll failed", {
        error: getErrorMessage(error),
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
          error: getErrorMessage(error),
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
        error: getErrorMessage(error),
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
        error: getErrorMessage(error),
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

          // For stdio servers, merge live process state from session manager
          let liveProcessState: StdioProcessState | undefined;
          if (server.type === "stdio") {
            const existingManager = this.stdioSessionManagers.get(server.name);
            if (existingManager) {
              liveProcessState = existingManager.getProcessState();
            }
          }

          return {
            ...server,
            ...metrics,
            // Override processState with live state if available
            ...(liveProcessState && { processState: liveProcessState }),
            health: healthData?.health,
            lastHealthCheck: healthData?.lastCheck,
            lastCheckTime: healthData?.lastCheckTime ?? undefined,
            lastHealthyTime: healthData?.lastHealthyTime ?? undefined,
            lastErrorTime: healthData?.lastErrorTime ?? undefined,
            errorMessage: healthData?.errorMessage ?? undefined,
            errorCode: healthData?.errorCode ?? undefined,
            responseTimeMs: healthData?.responseTimeMs ?? undefined,
          };
        }),
      );

      return serversWithData;
    } catch (error) {
      logger.error("Local storage getRegisteredServers failed", {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  async getServer(name: string): Promise<McpServer> {
    try {
      const servers = await this.getRegisteredServers();
      const server = servers.find((s) => s.name === name);
      if (!server) {
        throw new ServerNotFoundError(name);
      }
      return server;
    } catch (error) {
      logger.error("Local storage getServer failed", {
        error: getErrorMessage(error),
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

      // Check for unsupported /sse endpoint
      if (server.type === "http") {
        try {
          const parsedUrl = new URL(server.url);
          if (parsedUrl.pathname.endsWith("/sse")) {
            throw new UnsupportedServerUrlError(
              "SSE transport (/sse endpoint) is not yet supported. Please use the /mcp endpoint instead.",
            );
          }
        } catch (e) {
          if (e instanceof UnsupportedServerUrlError) {
            throw e;
          }
          // URL parsing failed - will be caught by other validation
        }
      }

      // Add new server with zero metrics (will be computed from logs)
      if (server.type === "http") {
        servers.push({
          ...server,
          lastActivity: null,
          exchangeCount: 0,
        });
      } else {
        servers.push({
          ...server,
          lastActivity: null,
          exchangeCount: 0,
          processState: {
            status: "stopped",
            pid: null,
            lastError: null,
            stderrLogs: [],
          },
        });
      }

      // Persist to file
      await this.saveRegistry(servers);
      logger.debug("Server added to registry", { name: server.name });

      // Eagerly initialize if shared mode stdio server
      if (server.type === "stdio" && server.sessionMode !== "isolated") {
        const manager = await this.getStdioSessionManager(server.name);
        try {
          await manager.initialize();
          logger.info("Initialized new shared stdio server", {
            name: server.name,
          });
        } catch (error) {
          logger.warn("Failed to initialize stdio server on add", {
            name: server.name,
            error: getErrorMessage(error),
          });
          // Don't throw - server was added to registry successfully
        }
      }
    } catch (error) {
      logger.error("Local storage addServer failed", {
        error: getErrorMessage(error),
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

      // Cleanup stdio session manager if exists
      const manager = this.stdioSessionManagers.get(name);
      if (manager) {
        logger.info("Terminating stdio session manager for removed server", {
          server: name,
        });
        await manager.terminate();
        this.stdioSessionManagers.delete(name);
      }

      // Remove server from registry
      servers.splice(index, 1);

      // Persist to file (logs are preserved for historical analysis)
      await this.saveRegistry(servers);
      logger.debug("Server removed from registry", { name });
    } catch (error) {
      logger.error("Local storage removeServer failed", {
        error: getErrorMessage(error),
        serverName: name,
      });
      throw error;
    }
  }

  /**
   * Check if config changes require stdio process restart
   */
  private requiresProcessRestart(
    changes: Partial<Omit<McpServerConfig, "name">>,
  ): boolean {
    return !!(
      "command" in changes ||
      "args" in changes ||
      "env" in changes ||
      "cwd" in changes ||
      "sessionMode" in changes ||
      "timeout" in changes
    );
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

      // Update the server's mutable fields based on type
      // Create updated server (immutable)
      let updatedServer: McpServer;

      if (server.type === "http") {
        const url =
          "url" in changes ? (changes as { url?: string }).url : undefined;

        if (url !== undefined && !isValidUrl(url)) {
          throw new Error(`Invalid URL format: ${url}`);
        }

        updatedServer = {
          ...server,
          ...(url !== undefined && { url }),
          ...("headers" in changes && {
            headers:
              (changes as { headers?: Record<string, string> }).headers ??
              server.headers,
          }),
        };
      } else {
        // Stdio server
        updatedServer = {
          ...server,
          ...("command" in changes && {
            command:
              (changes as { command?: string }).command ?? server.command,
          }),
          ...("args" in changes && {
            args: (changes as { args?: string[] }).args ?? server.args,
          }),
          ...("env" in changes && {
            env: (changes as { env?: Record<string, string> }).env,
          }),
          ...("cwd" in changes && {
            cwd: (changes as { cwd?: string }).cwd,
          }),
          ...("timeout" in changes && {
            timeout: (changes as { timeout?: number }).timeout,
          }),
          ...("sessionMode" in changes && {
            sessionMode: (changes as { sessionMode?: "shared" | "isolated" })
              .sessionMode,
          }),
        };
      }

      // Replace server in array
      const index = servers.findIndex((s) => s.name === name);
      servers[index] = updatedServer;

      // Persist to file
      await this.saveRegistry(servers);
      logger.debug("Server updated in registry", { name, changes });

      // Invalidate cached stdio manager if config requires restart
      if (updatedServer.type === "stdio") {
        const manager = this.stdioSessionManagers.get(name);
        if (manager && this.requiresProcessRestart(changes)) {
          const sessionCount = manager.getSessionCount();
          logger.warn(
            "Terminating stdio session manager due to config change",
            {
              server: name,
              activeSessions: sessionCount,
              changes: Object.keys(changes),
            },
          );
          await manager.terminate();
          this.stdioSessionManagers.delete(name);

          // Eagerly re-initialize if shared mode
          if (updatedServer.sessionMode !== "isolated") {
            try {
              const newManager = await this.getStdioSessionManager(name);
              await newManager.initialize();
              logger.info("Re-initialized stdio server after config change", {
                name,
              });
            } catch (error) {
              logger.warn("Failed to re-initialize stdio server after update", {
                name,
                error: getErrorMessage(error),
              });
              // Don't throw - config was updated successfully
            }
          }
        }
      }
    } catch (error) {
      logger.error("Local storage updateServer failed", {
        error: getErrorMessage(error),
        serverName: name,
      });
      throw error;
    }
  }

  async upsertServerHealth(
    serverName: string,
    health: HealthStatus,
    lastCheck: string,
    url?: string,
    lastCheckTime?: number,
    lastHealthyTime?: number,
    lastErrorTime?: number,
    errorMessage?: string,
    errorCode?: string,
    responseTimeMs?: number,
  ): Promise<void> {
    try {
      await upsertServerHealth(this.db, {
        serverName,
        health,
        lastCheck,
        url,
        lastCheckTime,
        lastHealthyTime,
        lastErrorTime,
        errorMessage,
        errorCode,
        responseTimeMs,
      });
      logger.debug("Server health updated", { serverName, health });
    } catch (error) {
      logger.error("Local storage upsertServerHealth failed", {
        error: getErrorMessage(error),
        serverName,
      });
      throw error;
    }
  }

  /**
   * Get or create stdio session manager for a server
   */
  async getStdioSessionManager(
    serverName: string,
  ): Promise<StdioSessionManager> {
    // Check if manager already exists
    const existing = this.stdioSessionManagers.get(serverName);
    if (existing) {
      return existing;
    }

    // Get server config
    const server = await this.getServer(serverName);
    if (server.type !== "stdio") {
      throw new Error(`Server '${serverName}' is not a stdio server`);
    }

    // Create new manager
    const manager = new StdioSessionManager(server);
    this.stdioSessionManagers.set(serverName, manager);
    return manager;
  }

  /**
   * Initialize all shared mode stdio servers eagerly
   * Called on gateway startup and when servers are added/updated
   *
   * @returns Results with succeeded/failed server names and error details
   */
  async initializeSharedStdioServers(): Promise<{
    total: number;
    succeeded: string[];
    failed: Array<{ name: string; error: string }>;
  }> {
    const servers = await this.loadRegistry();
    const sharedStdioServers = servers.filter(
      (s) => s.type === "stdio" && s.sessionMode !== "isolated",
    );

    if (sharedStdioServers.length === 0) {
      return { total: 0, succeeded: [], failed: [] };
    }

    logger.info("Initializing shared stdio servers", {
      count: sharedStdioServers.length,
      servers: sharedStdioServers.map((s) => s.name),
    });

    const succeeded: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    // Initialize in parallel for faster startup
    const results = await Promise.allSettled(
      sharedStdioServers.map(async (server) => {
        const manager = await this.getStdioSessionManager(server.name);
        await manager.initialize();
        return server.name;
      }),
    );

    // Collect results
    results.forEach((result, i) => {
      const server = sharedStdioServers[i];
      if (!server) return; // Guard: results and servers arrays should match length
      const serverName = server.name;

      if (result.status === "fulfilled") {
        succeeded.push(serverName);
        logger.info("Initialized shared stdio server", { name: serverName });
      } else {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        failed.push({ name: serverName, error: errorMessage });
        logger.error("Failed to initialize stdio server", {
          name: serverName,
          error: errorMessage,
        });
      }
    });

    return {
      total: sharedStdioServers.length,
      succeeded,
      failed,
    };
  }

  async close(): Promise<void> {
    try {
      // Close all stdio session managers
      for (const [serverName, manager] of this.stdioSessionManagers) {
        try {
          await manager.stop();
          logger.debug("Stopped stdio session manager", { serverName });
        } catch (error) {
          logger.warn("Error stopping stdio session manager", {
            serverName,
            error: getErrorMessage(error),
          });
        }
      }
      this.stdioSessionManagers.clear();

      this.client.close();
      logger.debug("Local storage backend closed", {
        storageDir: this.storageDir,
      });
    } catch (error) {
      logger.warn("Error closing local storage connection", {
        error: getErrorMessage(error),
      });
    }
  }
}

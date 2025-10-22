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
import { logger } from "../logger";
import type { StorageBackend, StorageWriteResult } from "./storage-backend.js";

/**
 * Storage manager
 *
 * Coordinates multiple storage backends, allowing them to work
 * independently and in parallel.
 */
export class StorageManager {
  private backends: Map<string, StorageBackend> = new Map();
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: storageDir is set in initialize() method
  private storageDir: string | null = null;
  private initialized = false;
  private registryCache: McpServer[] | null = null;

  /**
   * Register a storage backend
   *
   * @param backend - The storage backend to register
   */
  registerBackend(backend: StorageBackend): void {
    if (this.initialized) {
      throw new Error(
        "Cannot register backends after initialization. Call registerBackend before initialize().",
      );
    }

    this.backends.set(backend.name, backend);
    logger.debug("Storage backend registered", { name: backend.name });
  }

  /**
   * Initialize all registered backends
   *
   * @param storageDir - Base storage directory
   */
  async initialize(storageDir: string): Promise<void> {
    if (this.initialized) {
      logger.warn("Storage manager already initialized");
      return;
    }

    this.storageDir = storageDir;

    // Initialize all backends in parallel
    const initPromises = Array.from(this.backends.entries()).map(
      async ([name, backend]) => {
        await backend.initialize(storageDir);
        logger.info("Storage backend initialized", { name });
      },
    );

    await Promise.all(initPromises);
    this.initialized = true;
    logger.info("Storage manager initialized", {
      backends: Array.from(this.backends.keys()),
      storageDir,
    });
  }

  /**
   * Write a capture record to all registered backends
   *
   * All backends write in parallel. If any backend fails, the entire
   * write operation fails.
   *
   * Invalidates the registry cache because metrics (lastActivity, exchangeCount)
   * are computed from captured logs, and this write operation changes those logs.
   *
   * @param record - The capture record to write
   * @returns Map of backend names to write results
   */
  async write(record: CaptureRecord): Promise<Map<string, StorageWriteResult>> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const results = new Map<string, StorageWriteResult>();

    // Write to all backends in parallel
    const writePromises = Array.from(this.backends.entries()).map(
      async ([name, backend]) => {
        const result = await backend.write(record);
        results.set(name, result);
      },
    );

    await Promise.all(writePromises);

    // Invalidate cache after write because metrics depend on logs
    this.registryCache = null;

    return results;
  }

  /**
   * Query logs from the first available backend
   *
   * Note: Currently delegates to the first registered backend.
   * In practice, this will be the SQLite backend.
   *
   * @param options - Query options (filters, pagination, sorting)
   * @returns Paginated query result
   */
  async queryLogs(options?: LogQueryOptions): Promise<LogQueryResult> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    return await backend.queryLogs(options);
  }

  /**
   * Get server aggregations from the first available backend
   *
   * @returns List of server aggregation info
   */
  async getServers(): Promise<ServerInfo[]> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    return await backend.getServers();
  }

  /**
   * Get session aggregations from the first available backend
   *
   * @param serverName - Optional server filter
   * @returns List of session aggregation info
   */
  async getSessions(serverName?: string): Promise<SessionInfo[]> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    return await backend.getSessions(serverName);
  }

  /**
   * Get client aggregations from the first available backend
   *
   * @returns List of client aggregation info
   */
  async getClients(): Promise<ClientAggregation[]> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    return await backend.getClients();
  }

  /**
   * Clear all logs from all backends
   *
   * This is a destructive operation that removes all stored logs.
   * Use with caution.
   *
   * Invalidates the registry cache because metrics depend on logs.
   */
  async clearAll(): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    // Clear all backends in parallel
    const clearPromises = Array.from(this.backends.values()).map(
      async (backend) => {
        await backend.clearAll();
      },
    );

    await Promise.all(clearPromises);

    // Invalidate cache after clearing logs
    this.registryCache = null;

    logger.info("All storage backends cleared");
  }

  /**
   * Update server info for an initialize request after getting the response
   *
   * This backfills server metadata on the initialize request record,
   * which was captured before the response containing serverInfo was received.
   *
   * Note: Currently delegates to the first registered backend.
   *
   * @param serverName - Name of the server
   * @param sessionId - Session identifier
   * @param requestId - JSON-RPC request ID
   * @param serverInfo - Server information to backfill
   */
  async updateServerInfoForInitializeRequest(
    serverName: string,
    sessionId: string,
    requestId: string | number,
    serverInfo: { name?: string; version: string; title?: string },
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    await backend.updateServerInfoForInitializeRequest(
      serverName,
      sessionId,
      requestId,
      serverInfo,
    );
  }

  /**
   * Get session metadata by sessionId from the first available backend
   *
   * Returns client and server information for a specific session.
   * This metadata is persisted to SQLite and survives gateway restarts.
   *
   * Note: Currently delegates to the first registered backend.
   *
   * @param sessionId - The session ID to retrieve metadata for
   * @returns Session metadata (client and server info) or null if not found
   */
  async getSessionMetadata(sessionId: string): Promise<{
    client?: { name: string; version: string; title?: string };
    server?: { name?: string; version: string; title?: string };
  } | null> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    return await backend.getSessionMetadata(sessionId);
  }

  /**
   * Close all registered backends
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.backends.values()).map(
      async (backend) => {
        if (backend.close) {
          await backend.close();
        }
      },
    );

    await Promise.all(closePromises);
    this.initialized = false;
    logger.info("Storage manager closed");
  }

  /**
   * Get a specific backend by name
   *
   * @param name - Backend name
   * @returns The backend, or undefined if not found
   */
  getBackend(name: string): StorageBackend | undefined {
    return this.backends.get(name);
  }

  /**
   * Get all registered backend names
   */
  getBackendNames(): string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * Get metrics for a specific server
   *
   * @param serverName - Name of the server to get metrics for
   * @returns Metrics including last activity timestamp and request count
   */
  async getServerMetrics(
    serverName: string,
  ): Promise<{ lastActivity: string | null; exchangeCount: number }> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    return await backend.getServerMetrics(serverName);
  }

  /**
   * Get all registered servers with computed metrics
   *
   * Uses in-memory cache for performance. Cache is automatically
   * invalidated on:
   * - Server registry changes (add, remove, update)
   * - New log writes (metrics depend on captured logs)
   * - Log clear operations
   *
   * @returns List of all registered servers with current metrics
   */
  async getRegisteredServers(): Promise<McpServer[]> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    // Return cached result if available
    if (this.registryCache) {
      return this.registryCache;
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    // Fetch from backend and cache result
    this.registryCache = await backend.getRegisteredServers();
    return this.registryCache;
  }

  /**
   * Add a new server to the registry
   *
   * @param server - Server configuration to add
   * @throws Error if server name already exists
   */
  async addServer(server: McpServerConfig): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    await backend.addServer(server);
    this.registryCache = null; // Invalidate cache
  }

  /**
   * Remove a server from the registry
   *
   * @param name - Name of the server to remove
   * @throws Error if server doesn't exist
   */
  async removeServer(name: string): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    await backend.removeServer(name);
    this.registryCache = null; // Invalidate cache
  }

  /**
   * Update server configuration
   *
   * @param name - Name of the server to update
   * @param changes - Partial configuration to apply
   * @throws Error if server doesn't exist
   */
  async updateServer(
    name: string,
    changes: Partial<Omit<McpServerConfig, "name">>,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error(
        "Storage manager not initialized. Call initialize() first.",
      );
    }

    const backend = this.backends.values().next().value as
      | StorageBackend
      | undefined;
    if (!backend) {
      throw new Error("No storage backends registered");
    }

    await backend.updateServer(name, changes);
    this.registryCache = null; // Invalidate cache
  }
}

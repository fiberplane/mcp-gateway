import type {
  CaptureRecord,
  ClientInfo,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServer,
  McpServerInfo,
  Registry,
  ServerHealth,
} from "@fiberplane/mcp-gateway-types";
import { SqliteStorageBackend } from "./capture/backends/sqlite-backend.js";
import type { SSEEvent } from "./capture/sse-parser.js";
import { StorageManager } from "./capture/storage-manager.js";

/**
 * Gateway instance - scoped to a single storage directory
 *
 * Provides all core functionality without global state:
 * - Capture operations (write logs, handle errors, SSE events)
 * - Registry operations (get server, manage registry)
 * - Storage management (lifecycle)
 *
 * Created via `createGateway()` factory function.
 */
export interface Gateway {
  /**
   * Capture operations for logging MCP traffic
   */
  capture: {
    /**
     * Append a capture record to storage
     */
    append(record: CaptureRecord): Promise<void>;

    /**
     * Capture an error response
     */
    error(
      serverName: string,
      sessionId: string,
      request: JsonRpcRequest,
      error: { code: number; message: string; data?: unknown },
      httpStatus: number,
      durationMs: number,
    ): Promise<void>;

    /**
     * Capture an SSE event
     */
    sseEvent(
      serverName: string,
      sessionId: string,
      sseEvent: SSEEvent,
      method?: string,
      requestId?: string | number | null,
    ): Promise<void>;

    /**
     * Capture JSON-RPC message from SSE
     */
    sseJsonRpc(
      serverName: string,
      sessionId: string,
      jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
      sseEvent: SSEEvent,
      isResponse?: boolean,
    ): Promise<CaptureRecord | null>;
  };

  /**
   * Registry operations for server management
   */
  registry: {
    /**
     * Get a server from the registry by name
     */
    getServer(registry: Registry, name: string): McpServer | undefined;
  };

  /**
   * Client info management for sessions
   */
  clientInfo: {
    /**
     * Store client info for a session
     */
    store(sessionId: string, info: ClientInfo): void;

    /**
     * Get client info for a session
     *
     * Checks in-memory cache first, then falls back to SQLite.
     * This ensures session metadata persists across gateway restarts.
     */
    get(sessionId: string): Promise<ClientInfo | undefined>;

    /**
     * Clear client info for a session
     */
    clear(sessionId: string): void;

    /**
     * Clear all client info
     */
    clearAll(): void;

    /**
     * Get all active session IDs
     */
    getActiveSessions(): string[];
  };

  /**
   * Server info management for sessions
   */
  serverInfo: {
    /**
     * Store server info for a session
     */
    store(sessionId: string, info: McpServerInfo): void;

    /**
     * Get server info for a session
     *
     * Checks in-memory cache first, then falls back to SQLite.
     * This ensures session metadata persists across gateway restarts.
     */
    get(sessionId: string): Promise<McpServerInfo | undefined>;

    /**
     * Clear server info for a session
     */
    clear(sessionId: string): void;

    /**
     * Clear all server info
     */
    clearAll(): void;
  };

  /**
   * Request tracker for correlating requests and responses
   */
  requestTracker: {
    /**
     * Track a request for duration calculation
     */
    trackRequest(id: string | number, method: string): void;

    /**
     * Calculate duration and cleanup tracked request
     */
    calculateDuration(id: string | number): number;

    /**
     * Get method for a tracked request
     */
    getMethod(id: string | number): string | undefined;

    /**
     * Check if request is being tracked
     */
    hasRequest(id: string | number): boolean;
  };

  /**
   * Log query operations for retrieving captured traffic
   */
  logs: {
    /**
     * Query logs with filtering and pagination
     */
    query(
      options?: import("@fiberplane/mcp-gateway-types").LogQueryOptions,
    ): Promise<import("@fiberplane/mcp-gateway-types").LogQueryResult>;

    /**
     * Get server aggregations
     */
    getServers(): Promise<import("@fiberplane/mcp-gateway-types").ServerInfo[]>;

    /**
     * Get session aggregations
     */
    getSessions(
      serverName?: string,
    ): Promise<import("@fiberplane/mcp-gateway-types").SessionInfo[]>;

    /**
     * Get client aggregations
     */
    getClients(): Promise<
      import("@fiberplane/mcp-gateway-types").ClientAggregation[]
    >;

    /**
     * Clear all logs
     *
     * This is a destructive operation that removes all stored logs.
     * Use with caution.
     */
    clearAll(): Promise<void>;

    /**
     * Update server info for an initialize request after getting the response
     *
     * This backfills server metadata on the initialize request record,
     * which was captured before the response containing serverInfo was received.
     */
    updateServerInfoForInitializeRequest(
      serverName: string,
      sessionId: string,
      requestId: string | number,
      serverInfo: { name?: string; version: string; title?: string },
    ): Promise<void>;
  };

  /**
   * Health check operations for monitoring server availability
   */
  health: {
    /**
     * Start periodic health checks
     * @param registry - Registry containing servers to check
     * @param intervalMs - Check interval in milliseconds (default 30000)
     * @param onUpdate - Optional callback called with health updates
     */
    start(
      registry: Registry,
      intervalMs?: number,
      onUpdate?: (
        updates: Array<{
          name: string;
          health: ServerHealth;
          lastHealthCheck: string;
        }>,
      ) => void,
    ): Promise<void>;

    /**
     * Stop periodic health checks
     */
    stop(): void;

    /**
     * Manually trigger a health check for all servers
     * @param registry - Registry containing servers to check
     */
    check(registry: Registry): Promise<
      Array<{
        name: string;
        health: ServerHealth;
        lastHealthCheck: string;
      }>
    >;
  };

  /**
   * Get the database connection for direct queries
   *
   * Returns the underlying database connection from the SQLite backend.
   * Used by MCP tools to query server metrics.
   *
   * @returns The database connection, or null if not available
   */
  getDb(): unknown;

  /**
   * Close all connections and clean up resources
   */
  close(): Promise<void>;
}

/**
 * Options for creating a Gateway instance
 */
export interface GatewayOptions {
  /**
   * Storage directory for logs and registry
   */
  storageDir: string;
}

// In-memory storage for client info by session (scoped to Gateway instance)
class ClientInfoStore {
  private sessionClientInfo = new Map<string, ClientInfo>();
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  store(sessionId: string, clientInfo: ClientInfo): void {
    this.sessionClientInfo.set(sessionId, clientInfo);
  }

  async get(sessionId: string): Promise<ClientInfo | undefined> {
    // Try in-memory first
    const cached = this.sessionClientInfo.get(sessionId);
    if (cached) {
      return cached;
    }

    // Fall back to SQLite
    try {
      const metadata = await this.storageManager.getSessionMetadata(sessionId);
      return metadata?.client;
    } catch {
      // If SQLite query fails, return undefined
      return undefined;
    }
  }

  clear(sessionId: string): void {
    this.sessionClientInfo.delete(sessionId);
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessionClientInfo.keys()).filter(
      (id) => id !== "stateless",
    );
  }

  clearAll(): void {
    this.sessionClientInfo.clear();
  }
}

// In-memory storage for server info by session (scoped to Gateway instance)
class ServerInfoStore {
  private sessionServerInfo = new Map<string, McpServerInfo>();
  private storageManager: StorageManager;

  constructor(storageManager: StorageManager) {
    this.storageManager = storageManager;
  }

  private normalizeServerInfo(server: unknown): McpServerInfo | undefined {
    if (!server || typeof server !== "object") {
      return undefined;
    }

    const candidate = server as Partial<McpServerInfo>;

    if (typeof candidate.name !== "string" || candidate.name.length === 0) {
      return undefined;
    }

    if (typeof candidate.version !== "string" || candidate.version.length === 0) {
      return undefined;
    }

    return {
      name: candidate.name,
      version: candidate.version,
      title: candidate.title,
    };
  }

  store(sessionId: string, serverInfo: McpServerInfo): void {
    this.sessionServerInfo.set(sessionId, serverInfo);
  }

  async get(sessionId: string): Promise<McpServerInfo | undefined> {
    // Try to get serverInfo for this session from in-memory first
    let serverInfo = this.sessionServerInfo.get(sessionId);

    // If not found and this isn't the stateless session, try falling back to stateless in-memory
    // This ensures server metadata is always available even if session transition fails
    if (!serverInfo && sessionId !== "stateless") {
      serverInfo = this.sessionServerInfo.get("stateless");
    }

    // If still not found, try SQLite
    if (!serverInfo) {
      try {
        const metadata = await this.storageManager.getSessionMetadata(sessionId);
        serverInfo = this.normalizeServerInfo(metadata?.server);
        // Also try stateless as fallback in SQLite
        if (!serverInfo && sessionId !== "stateless") {
          const statelessMetadata =
            await this.storageManager.getSessionMetadata("stateless");
          serverInfo = this.normalizeServerInfo(statelessMetadata?.server);
        }
      } catch {
        // If SQLite query fails, return undefined
        return undefined;
      }
    }

    return serverInfo;
  }

  clear(sessionId: string): void {
    this.sessionServerInfo.delete(sessionId);
  }

  clearAll(): void {
    this.sessionServerInfo.clear();
  }
}

// Store request start times for duration calculation (scoped to Gateway instance)
class RequestTracker {
  private requestStartTimes = new Map<string | number, number>();
  private requestMethods = new Map<string | number, string>();

  trackRequest(id: string | number, method: string): void {
    this.requestStartTimes.set(id, Date.now());
    this.requestMethods.set(id, method);
  }

  calculateDuration(id: string | number): number {
    const startTime = this.requestStartTimes.get(id);
    if (startTime === undefined) {
      return 0;
    }
    const duration = Date.now() - startTime;
    this.requestStartTimes.delete(id);
    this.requestMethods.delete(id);
    return duration;
  }

  getMethod(id: string | number): string | undefined {
    return this.requestMethods.get(id);
  }

  hasRequest(id: string | number): boolean {
    return this.requestStartTimes.has(id);
  }
}

// Manage health check lifecycle (scoped to Gateway instance)
class HealthCheckManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private onUpdate:
    | ((
        updates: Array<{
          name: string;
          health: ServerHealth;
          lastHealthCheck: string;
        }>,
      ) => void)
    | null = null;

  async checkServerHealth(url: string): Promise<ServerHealth> {
    try {
      // Try OPTIONS first (lightweight), fallback to HEAD
      const response = await fetch(url, {
        method: "OPTIONS",
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      // 2xx, 3xx, 4xx all mean server is responding
      // Only 5xx or network errors mean "down"
      if (response.status < 500) {
        return "up";
      }

      return "down";
    } catch (_error) {
      // Network errors, timeouts, DNS failures = down
      return "down";
    }
  }

  async check(
    registry: Registry,
  ): Promise<
    Array<{ name: string; health: ServerHealth; lastHealthCheck: string }>
  > {
    const updates = await Promise.all(
      registry.servers.map(async (server) => {
        const health = await this.checkServerHealth(server.url);
        const lastHealthCheck = new Date().toISOString();

        // Update the registry object for non-TUI usage
        server.health = health;
        server.lastHealthCheck = lastHealthCheck;

        return {
          name: server.name,
          health,
          lastHealthCheck,
        };
      }),
    );

    // Call custom update handler if provided (for TUI)
    if (this.onUpdate) {
      this.onUpdate(updates);
    }

    return updates;
  }

  async start(
    registry: Registry,
    intervalMs = 30000,
    onUpdate?: (
      updates: Array<{
        name: string;
        health: ServerHealth;
        lastHealthCheck: string;
      }>,
    ) => void,
  ): Promise<void> {
    // Stop any existing health checks
    this.stop();

    // Store the update callback
    this.onUpdate = onUpdate || null;

    // Initial check (await to ensure it completes before returning)
    await this.check(registry);

    // Periodic checks
    this.timer = setInterval(() => {
      this.check(registry).catch((error) => {
        // Log error but don't stop health checks
        // biome-ignore lint/suspicious/noConsole: Needed to log background health check errors
        console.error("Health check failed:", error);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.onUpdate = null;
  }
}

/**
 * Create a scoped Gateway instance
 *
 * This replaces the old global singleton pattern with a factory that returns
 * a scoped instance. Each instance manages its own storage connections and state.
 *
 * @param options - Gateway configuration
 * @returns Gateway instance
 *
 * @example
 * ```typescript
 * const gateway = await createGateway({ storageDir: "~/.mcp-gateway" });
 *
 * // Use capture operations
 * await gateway.capture.append(record);
 *
 * // Use registry operations
 * const server = gateway.registry.getServer(registry, "my-server");
 *
 * // Cleanup on shutdown
 * await gateway.close();
 * ```
 */
export async function createGateway(options: GatewayOptions): Promise<Gateway> {
  const { storageDir } = options;

  // Create scoped storage manager (not global)
  const storageManager = new StorageManager();
  storageManager.registerBackend(new SqliteStorageBackend());
  await storageManager.initialize(storageDir);

  // Create scoped client info store with SQLite fallback
  const clientInfoStore = new ClientInfoStore(storageManager);

  // Create scoped server info store with SQLite fallback
  const serverInfoStore = new ServerInfoStore(storageManager);

  // Create scoped request tracker
  const requestTracker = new RequestTracker();

  // Create scoped health check manager
  const healthCheckManager = new HealthCheckManager();

  // Import capture functions dynamically to avoid circular dependencies
  const captureModule = await import("./capture/index.js");

  return {
    capture: {
      append: async (record: CaptureRecord) => {
        await storageManager.write(record);
      },

      error: async (
        serverName: string,
        sessionId: string,
        request: JsonRpcRequest,
        error: { code: number; message: string; data?: unknown },
        httpStatus: number,
        durationMs: number,
      ) => {
        // Only capture error response if request expected a response
        if (request.id == null) {
          return; // Notification errors aren't sent back
        }

        const errorResponse: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: request.id,
          error,
        };

        const record = captureModule.createResponseCaptureRecord(
          serverName,
          sessionId,
          errorResponse,
          httpStatus,
          request.method,
          undefined, // httpContext - not available in Gateway.error API
          await clientInfoStore.get(sessionId),
          undefined, // serverInfo - not available in Gateway.error API
          requestTracker,
        );

        // Override the calculated duration with the provided one
        record.metadata.durationMs = durationMs;

        await storageManager.write(record);
      },

      sseEvent: async (
        serverName: string,
        sessionId: string,
        sseEvent: SSEEvent,
        method?: string,
        requestId?: string | number | null,
      ) => {
        try {
          const record = captureModule.createSSEEventCaptureRecord(
            serverName,
            sessionId,
            sseEvent,
            method,
            requestId,
            undefined, // httpContext - not available in Gateway.sseEvent API
            await clientInfoStore.get(sessionId),
          );
          await storageManager.write(record);
        } catch (error) {
          // Import logger dynamically to avoid circular deps
          const { logger } = await import("./logger.js");
          logger.error("Failed to capture SSE event", { error: String(error) });
          // Don't throw - SSE capture failures shouldn't break streaming
        }
      },

      sseJsonRpc: async (
        serverName: string,
        sessionId: string,
        jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
        sseEvent: SSEEvent,
        isResponse = false,
      ) => {
        try {
          const record = captureModule.createSSEJsonRpcCaptureRecord(
            serverName,
            sessionId,
            jsonRpcMessage,
            sseEvent,
            isResponse,
            undefined, // httpContext - not available in Gateway.sseJsonRpc API
            await clientInfoStore.get(sessionId),
            undefined, // serverInfo - not available in Gateway.sseJsonRpc API
            requestTracker,
          );
          await storageManager.write(record);
          return record;
        } catch (error) {
          const { logger } = await import("./logger.js");
          logger.error("Failed to capture SSE JSON-RPC", {
            error: String(error),
          });
          // Don't throw - SSE capture failures shouldn't break streaming
          return null;
        }
      },
    },

    registry: {
      getServer: (registry: Registry, name: string) => {
        return registry.servers.find((s) => s.name === name);
      },
    },

    clientInfo: {
      store: (sessionId: string, info: ClientInfo) =>
        clientInfoStore.store(sessionId, info),
      get: (sessionId: string) => clientInfoStore.get(sessionId),
      clear: (sessionId: string) => clientInfoStore.clear(sessionId),
      clearAll: () => clientInfoStore.clearAll(),
      getActiveSessions: () => clientInfoStore.getActiveSessions(),
    },

    serverInfo: {
      store: (sessionId: string, info: McpServerInfo) =>
        serverInfoStore.store(sessionId, info),
      get: (sessionId: string) => serverInfoStore.get(sessionId),
      clear: (sessionId: string) => serverInfoStore.clear(sessionId),
      clearAll: () => serverInfoStore.clearAll(),
    },

    requestTracker: {
      trackRequest: (id: string | number, method: string) =>
        requestTracker.trackRequest(id, method),
      calculateDuration: (id: string | number) =>
        requestTracker.calculateDuration(id),
      getMethod: (id: string | number) => requestTracker.getMethod(id),
      hasRequest: (id: string | number) => requestTracker.hasRequest(id),
    },

    logs: {
      query: async (options?) => await storageManager.queryLogs(options),
      getServers: async () => await storageManager.getServers(),
      getSessions: async (serverName?) =>
        await storageManager.getSessions(serverName),
      getClients: async () => await storageManager.getClients(),
      clearAll: async () => await storageManager.clearAll(),
      updateServerInfoForInitializeRequest: async (
        serverName: string,
        sessionId: string,
        requestId: string | number,
        serverInfo: { name?: string; version: string; title?: string },
      ) =>
        await storageManager.updateServerInfoForInitializeRequest(
          serverName,
          sessionId,
          requestId,
          serverInfo,
        ),
    },

    health: {
      start: async (
        registry: Registry,
        intervalMs?: number,
        onUpdate?: (
          updates: Array<{
            name: string;
            health: ServerHealth;
            lastHealthCheck: string;
          }>,
        ) => void,
      ) => {
        await healthCheckManager.start(registry, intervalMs, onUpdate);
      },
      stop: () => {
        healthCheckManager.stop();
      },
      check: async (registry: Registry) => {
        return await healthCheckManager.check(registry);
      },
    },

    getDb: () => {
      return storageManager.getDb();
    },

    close: async () => {
      healthCheckManager.stop();
      await storageManager.close();
    },
  };
}

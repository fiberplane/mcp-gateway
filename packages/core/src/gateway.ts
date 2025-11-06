import type {
  ApiLogEntry,
  CaptureRecord,
  ClientInfo,
  Gateway,
  GatewayOptions,
  HealthStatus,
  HttpContext,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServer,
  McpServerInfo,
  RequestTracker,
  SSEEvent,
  StorageBackend,
} from "@fiberplane/mcp-gateway-types";
import { mcpServerInfoSchema } from "@fiberplane/mcp-gateway-types";
import { LocalStorageBackend } from "./capture/backends/local-backend.js";
import {
  createResponseCaptureRecord,
  createSSEEventCaptureRecord,
  createSSEJsonRpcCaptureRecord,
  resolveJsonRpcMethod,
} from "./capture/index.js";
import { checkServerHealth } from "./health.js";
import { logger } from "./logger.js";
import { getMethodDetail } from "./utils/method-detail.js";

// In-memory storage for client info by session (scoped to Gateway instance)
class ClientInfoStore {
  private sessionClientInfo = new Map<string, ClientInfo>();
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
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

    // Fall back to storage backend
    try {
      const metadata = await this.backend.getSessionMetadata(sessionId);
      return metadata?.client;
    } catch {
      // If storage query fails, return undefined
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
  private backend: StorageBackend;

  constructor(backend: StorageBackend) {
    this.backend = backend;
  }

  private normalizeServerInfo(server: unknown): McpServerInfo | undefined {
    if (!server) {
      return undefined;
    }

    const result = mcpServerInfoSchema.safeParse(server);
    if (!result.success) {
      logger.debug("Discarding invalid server info from session metadata", {
        issues: result.error.issues,
      });
      return undefined;
    }

    return result.data;
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

    // If still not found, try storage backend
    if (!serverInfo) {
      try {
        const metadata = await this.backend.getSessionMetadata(sessionId);
        serverInfo = this.normalizeServerInfo(metadata?.server);
        // Also try stateless as fallback in storage
        if (!serverInfo && sessionId !== "stateless") {
          const statelessMetadata =
            await this.backend.getSessionMetadata("stateless");
          serverInfo = this.normalizeServerInfo(statelessMetadata?.server);
        }
      } catch {
        // If storage query fails, return undefined
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
class InMemoryRequestTracker implements RequestTracker {
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
          health: HealthStatus;
          lastHealthCheck: string;
        }>,
      ) => void)
    | null = null;
  private persistHealth: (
    serverName: string,
    health: HealthStatus,
    lastCheck: string,
    url: string,
    lastCheckTime?: number,
    lastHealthyTime?: number,
    lastErrorTime?: number,
    errorMessage?: string,
    errorCode?: string,
    responseTimeMs?: number,
  ) => Promise<void>;
  private getServers: () => Promise<McpServer[]>;

  constructor(
    persistHealth: (
      serverName: string,
      health: HealthStatus,
      lastCheck: string,
      url: string,
      lastCheckTime?: number,
      lastHealthyTime?: number,
      lastErrorTime?: number,
      errorMessage?: string,
      errorCode?: string,
      responseTimeMs?: number,
    ) => Promise<void>,
    getServers: () => Promise<McpServer[]>,
  ) {
    this.persistHealth = persistHealth;
    this.getServers = getServers;
  }

  /**
   * Check health of a single server by name
   */
  async checkOne(
    serverName: string,
  ): Promise<{ name: string; health: HealthStatus; lastHealthCheck: string }> {
    const servers = await this.getServers();
    const server = servers.find((s) => s.name === serverName);

    if (!server) {
      throw new Error(`Server '${serverName}' not found`);
    }

    const result = await checkServerHealth(server.url);
    const lastHealthCheck = new Date().toISOString();
    const health: HealthStatus = result.status === "online" ? "up" : "down";

    // Update the server object (for backward compatibility)
    server.health = health;
    server.lastHealthCheck = lastHealthCheck;

    // Persist health to database with extended details
    try {
      await this.persistHealth(
        server.name,
        health,
        lastHealthCheck,
        server.url,
        result.timestamp,
        result.status === "online" ? result.timestamp : server.lastHealthyTime,
        result.status === "offline" ? result.timestamp : server.lastErrorTime,
        result.errorMessage,
        result.errorCode,
        result.responseTimeMs,
      );
    } catch (error) {
      logger.warn("Failed to persist health check to database", {
        serverName: server.name,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - health check persistence failures shouldn't break health checking
    }

    return {
      name: server.name,
      health,
      lastHealthCheck,
    };
  }

  async check(): Promise<
    Array<{ name: string; health: HealthStatus; lastHealthCheck: string }>
  > {
    // Fetch servers internally
    const servers = await this.getServers();

    const updates = await Promise.all(
      servers.map(async (server) => {
        const result = await checkServerHealth(server.url);
        const lastHealthCheck = new Date().toISOString();
        const health: HealthStatus = result.status === "online" ? "up" : "down";

        // Update the server object (for backward compatibility)
        server.health = health;
        server.lastHealthCheck = lastHealthCheck;

        // Persist health to database with extended details
        try {
          await this.persistHealth(
            server.name,
            health,
            lastHealthCheck,
            server.url,
            result.timestamp,
            result.status === "online"
              ? result.timestamp
              : server.lastHealthyTime,
            result.status === "offline"
              ? result.timestamp
              : server.lastErrorTime,
            result.errorMessage,
            result.errorCode,
            result.responseTimeMs,
          );
        } catch (error) {
          logger.warn("Failed to persist health check to database", {
            serverName: server.name,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't throw - health check persistence failures shouldn't break health checking
        }

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
    intervalMs = 30000,
    onUpdate?: (
      updates: Array<{
        name: string;
        health: HealthStatus;
        lastHealthCheck: string;
      }>,
    ) => void,
  ): Promise<void> {
    // Stop any existing health checks
    this.stop();

    // Store the update callback
    this.onUpdate = onUpdate || null;

    // Initial check (await to ensure it completes before returning)
    await this.check();

    // Periodic checks
    this.timer = setInterval(() => {
      this.check().catch((error) => {
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
 * // Get a server
 * const server = await gateway.storage.getServer("my-server");
 *
 * // Cleanup on shutdown
 * await gateway.close();
 * ```
 */
export async function createGateway(options: GatewayOptions): Promise<Gateway> {
  const { storageDir } = options;

  // Create scoped storage backend (await initialization)
  const backend: StorageBackend = await LocalStorageBackend.create(storageDir);

  // Create scoped client info store with storage fallback
  const clientInfoStore = new ClientInfoStore(backend);

  // Create scoped server info store with storage fallback
  const serverInfoStore = new ServerInfoStore(backend);

  // Create scoped request tracker
  const requestTracker = new InMemoryRequestTracker();

  // Create scoped health check manager with database persistence
  const healthCheckManager = new HealthCheckManager(
    backend.upsertServerHealth.bind(backend),
    backend.getRegisteredServers.bind(backend),
  );

  return {
    capture: {
      append: async (record: CaptureRecord) => {
        await backend.write(record);
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

        const record = createResponseCaptureRecord(
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

        await backend.write(record);
      },

      sseEvent: async (
        serverName: string,
        sessionId: string,
        sseEvent: SSEEvent,
        method?: string,
        requestId?: string | number | null,
      ) => {
        try {
          const record = createSSEEventCaptureRecord(
            serverName,
            sessionId,
            sseEvent,
            method,
            requestId,
            undefined, // httpContext - not available in Gateway.sseEvent API
            await clientInfoStore.get(sessionId),
          );
          await backend.write(record);
        } catch (error) {
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
        httpContext?: HttpContext,
        clientInfo?: ClientInfo,
        serverInfo?: McpServerInfo,
      ) => {
        try {
          // Compute methodDetail before creating capture record
          const method = resolveJsonRpcMethod(jsonRpcMessage, requestTracker);
          const apiLogEntry: ApiLogEntry = isResponse
            ? {
                timestamp: new Date().toISOString(),
                method,
                id: jsonRpcMessage.id ?? null,
                direction: "response" as const,
                metadata: {
                  serverName,
                  sessionId,
                  durationMs: 0,
                  httpStatus: 200,
                },
                response: jsonRpcMessage as JsonRpcResponse,
              }
            : {
                timestamp: new Date().toISOString(),
                method,
                id: jsonRpcMessage.id ?? null,
                direction: "request" as const,
                metadata: {
                  serverName,
                  sessionId,
                  durationMs: 0,
                  httpStatus: 200,
                },
                request: jsonRpcMessage as JsonRpcRequest,
              };
          const methodDetail = getMethodDetail(apiLogEntry);

          const record = createSSEJsonRpcCaptureRecord(
            serverName,
            sessionId,
            jsonRpcMessage,
            sseEvent,
            isResponse,
            httpContext,
            clientInfo ?? (await clientInfoStore.get(sessionId)),
            serverInfo ?? (await serverInfoStore.get(sessionId)),
            requestTracker,
            methodDetail,
          );
          await backend.write(record);
          return record;
        } catch (error) {
          logger.error("Failed to capture SSE JSON-RPC", {
            error: String(error),
          });
          // Don't throw - SSE capture failures shouldn't break streaming
          return null;
        }
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

    storage: {
      getRegisteredServers: async () => await backend.getRegisteredServers(),
      getServer: async (name) => await backend.getServer(name),
      addServer: async (server) => await backend.addServer(server),
      removeServer: async (name) => await backend.removeServer(name),
      updateServer: async (name, changes) =>
        await backend.updateServer(name, changes),
      query: async (options?) => await backend.queryLogs(options),
      getServers: async () => await backend.getServers(),
      getSessions: async (serverName?) => await backend.getSessions(serverName),
      getClients: async () => await backend.getClients(),
      getMethods: async (serverName?) => await backend.getMethods(serverName),
      getServerMetrics: async (serverName: string) =>
        await backend.getServerMetrics(serverName),
      clearAll: async () => await backend.clearAll(),
      updateServerInfoForInitializeRequest: async (
        serverName: string,
        sessionId: string,
        requestId: string | number,
        serverInfo: { name?: string; version: string; title?: string },
      ) =>
        await backend.updateServerInfoForInitializeRequest(
          serverName,
          sessionId,
          requestId,
          serverInfo,
        ),
    },

    health: {
      start: async (
        intervalMs?: number,
        onUpdate?: (
          updates: Array<{
            name: string;
            health: HealthStatus;
            lastHealthCheck: string;
          }>,
        ) => void,
      ) => {
        await healthCheckManager.start(intervalMs, onUpdate);
      },
      stop: () => {
        healthCheckManager.stop();
      },
      check: async () => {
        return await healthCheckManager.check();
      },
    },

    close: async () => {
      healthCheckManager.stop();
      await backend.close?.();
    },
  };
}

import type { RequestTracker } from "./capture";
import type {
  ClientAggregation,
  LogQueryOptions,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "./logs";
import type {
  McpServer,
  McpServerConfig,
  Registry,
  HealthStatus,
} from "./registry";
import type {
  CaptureRecord,
  ClientInfo,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerInfo,
} from "./schemas";

/**
 * HTTP context information for requests
 *
 * Contains metadata about the HTTP request context,
 * extracted from headers and connection information.
 */
export interface HttpContext {
  userAgent?: string;
  clientIp?: string;
}

/**
 * Server-Sent Event (SSE) structure
 *
 * Represents a single SSE event parsed from SSE stream.
 * Used for streaming responses from MCP servers.
 */
export interface SSEEvent {
  id?: string;
  event?: string;
  data?: string;
  retry?: number;
}

/**
 * Gateway instance - scoped to a single storage directory
 *
 * Provides all core functionality without global state:
 * - Capture operations (write logs, handle errors, SSE events)
 * - Registry operations (get server, manage registry)
 * - Storage management (lifecycle)
 *
 * Created via `createGateway()` factory function in @fiberplane/mcp-gateway-core.
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
      httpContext?: HttpContext,
      clientInfo?: ClientInfo,
      serverInfo?: McpServerInfo,
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
   *
   * Tracks requests and calculates response times for JSON-RPC request/response pairs.
   */
  requestTracker: RequestTracker;

  /**
   * Storage and database operations for querying captured traffic and metadata
   */
  storage: {
    /**
     * Get all registered servers with current metrics
     */
    getRegisteredServers(): Promise<McpServer[]>;

    /**
     * Add a new server to the registry
     */
    addServer(server: McpServerConfig): Promise<void>;

    /**
     * Remove a server from the registry
     */
    removeServer(name: string): Promise<void>;

    /**
     * Update server configuration
     */
    updateServer(
      name: string,
      changes: Partial<Omit<McpServerConfig, "name">>,
    ): Promise<void>;

    /**
     * Query logs with filtering and pagination
     */
    query(options?: LogQueryOptions): Promise<LogQueryResult>;

    /**
     * Get server aggregations from storage
     */
    getServers(): Promise<ServerInfo[]>;

    /**
     * Get session aggregations from storage
     */
    getSessions(serverName?: string): Promise<SessionInfo[]>;

    /**
     * Get client aggregations from storage
     */
    getClients(): Promise<ClientAggregation[]>;

    /**
     * Get metrics for a specific server
     *
     * Returns activity metrics for a server computed from stored logs.
     *
     * @param serverName - Name of the server to get metrics for
     * @returns Metrics including last activity timestamp and request count
     */
    getServerMetrics(
      serverName: string,
    ): Promise<{ lastActivity: string | null; exchangeCount: number }>;

    /**
     * Clear all logs from storage
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
          health: HealthStatus;
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
        health: HealthStatus;
        lastHealthCheck: string;
      }>
    >;
  };

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

import type { HttpContext } from "./gateway.js";
import type { LogQueryOptions, LogQueryResult } from "./logs.js";
import type { McpServer, McpServerConfig } from "./registry.js";
import type {
  CaptureRecord,
  ClientInfo,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerInfo,
} from "./schemas.js";

/**
 * Dependency injection interface for proxy routes
 *
 * These callbacks decouple the server package from core package,
 * allowing the CLI to wire in Gateway methods at runtime.
 *
 * All capture and session management operations are injected through this interface.
 */
export interface ProxyDependencies {
  /** Create a request capture record */
  createRequestRecord: (
    serverName: string,
    sessionId: string,
    request: JsonRpcRequest,
    httpContext?: HttpContext,
    clientInfo?: ClientInfo,
    serverInfo?: McpServerInfo,
  ) => CaptureRecord;

  /** Create a response capture record */
  createResponseRecord: (
    serverName: string,
    sessionId: string,
    response: JsonRpcResponse,
    httpStatus: number,
    method: string,
    httpContext?: HttpContext,
    clientInfo?: ClientInfo,
    serverInfo?: McpServerInfo,
  ) => CaptureRecord;

  /** Append a capture record to storage */
  appendRecord: (record: CaptureRecord) => Promise<void>;

  /** Capture an error response */
  captureErrorResponse: (
    serverName: string,
    sessionId: string,
    request: JsonRpcRequest,
    error: { code: number; message: string; data?: unknown },
    httpStatus: number,
    durationMs: number,
    httpContext?: HttpContext,
  ) => Promise<void>;

  /** Capture an SSE event */
  captureSSEEventData: (
    serverName: string,
    sessionId: string,
    sseEvent: { id?: string; event?: string; data?: string; retry?: number },
    method?: string,
    requestId?: string | number | null,
    httpContext?: HttpContext,
  ) => Promise<void>;

  /** Capture JSON-RPC message from SSE */
  captureSSEJsonRpcMessage: (
    serverName: string,
    sessionId: string,
    jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
    sseEvent: { id?: string; event?: string; data?: string; retry?: number },
    isResponse?: boolean,
    httpContext?: HttpContext,
    clientInfo?: ClientInfo,
    serverInfo?: McpServerInfo,
  ) => Promise<CaptureRecord | null>;

  /** Store client info for a session */
  storeClientInfoForSession: (sessionId: string, info: ClientInfo) => void;

  /** Get client info for a session */
  getClientInfoForSession: (
    sessionId: string,
  ) => Promise<ClientInfo | undefined>;

  /** Store server info for a session */
  storeServerInfoForSession: (sessionId: string, info: McpServerInfo) => void;

  /** Get server info for a session */
  getServerInfoForSession: (
    sessionId: string,
  ) => Promise<McpServerInfo | undefined>;

  /** Update server info for an initialize request after getting the response */
  updateServerInfoForInitializeRequest: (
    serverName: string,
    sessionId: string,
    requestId: string | number,
    serverInfo: McpServerInfo,
  ) => Promise<void>;

  /** Get a server from the registry */
  getServerFromRegistry: (
    registry: { servers: McpServer[] },
    name: string,
  ) => McpServer | undefined;
}

/**
 * Dependency injection interface for REST API routes
 *
 * Decouples the API package from the storage implementation,
 * allowing different query backends to be plugged in.
 */
export interface QueryFunctions {
  /**
   * Query logs with optional filters and pagination
   */
  queryLogs: (
    storageDir: string,
    options?: LogQueryOptions,
  ) => Promise<LogQueryResult>;

  /**
   * Get all servers with aggregated stats
   */
  getServers: (storageDir: string) => Promise<
    Array<{
      name: string;
      logCount: number;
      sessionCount: number;
    }>
  >;

  /**
   * Get all sessions with aggregated stats
   */
  getSessions: (
    storageDir: string,
    serverName?: string,
  ) => Promise<
    Array<{
      sessionId: string;
      serverName: string;
      logCount: number;
      startTime: string;
      endTime: string;
    }>
  >;

  /**
   * Get all clients with aggregated stats
   */
  getClients: (storageDir: string) => Promise<
    Array<{
      clientName: string;
      clientVersion: string | null;
      logCount: number;
      sessionCount: number;
    }>
  >;

  /**
   * Clear all session data (client info and server info)
   */
  clearSessions: () => Promise<void>;
}

/**
 * Dependencies for server management tools
 *
 * Defines the interface for functions that server tools (add_server, remove_server, list_servers)
 * need to operate. This makes the dependencies explicit and testable without needing the full Gateway.
 *
 * All operations delegate to the storage layer which handles persistence internally.
 */
export interface ServerToolsDependencies {
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
}

/**
 * Dependencies for capture analysis tools
 *
 * Defines the interface for functions that capture tools (search_records) need to operate.
 * This makes the dependencies explicit and testable without needing the full Gateway.
 */
export interface CaptureToolsDependencies {
  /**
   * Query captured logs with filtering and pagination
   */
  query(options?: LogQueryOptions): Promise<LogQueryResult>;
}

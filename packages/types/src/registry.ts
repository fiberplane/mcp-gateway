// Health status for servers
export type HealthStatus = "up" | "down" | "unknown";

/**
 * Result from a health check operation
 */
export interface HealthCheckResult {
  /** Status determined by health check */
  status: "online" | "offline";
  /** Response time in milliseconds (only for successful checks) */
  responseTimeMs?: number;
  /** Error code if check failed (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, HTTP_ERROR, INVALID_RESPONSE, TIMEOUT) */
  errorCode?: string;
  /** Detailed error message if check failed */
  errorMessage?: string;
  /** Timestamp when check was performed */
  timestamp: number;
}

/**
 * HTTP MCP Server configuration (persisted to mcp.json)
 */
export interface HttpServerConfig {
  /** Server identifier (unique, persisted) */
  readonly name: string;
  /** Server endpoint URL (persisted) */
  readonly url: string;
  /** Protocol type */
  readonly type: "http";
  /** HTTP headers to include with requests (persisted) */
  readonly headers: Record<string, string>;
}

/**
 * Stdio MCP Server configuration (persisted to mcp.json)
 *
 * Spawns a local subprocess and communicates via stdin/stdout
 * using newline-delimited JSON-RPC 2.0.
 */
export interface StdioServerConfig {
  /** Server identifier (unique, persisted) */
  readonly name: string;
  /** Protocol type */
  readonly type: "stdio";
  /** Executable command (e.g., "node", "python", "bun") */
  readonly command: string;
  /** Command arguments (e.g., ["./server.js", "--debug"]) */
  readonly args: readonly string[];
  /** Environment variables for subprocess */
  readonly env?: Record<string, string>;
  /** Working directory for subprocess */
  readonly cwd?: string;
  /** Request timeout in milliseconds (default: 30000) */
  readonly timeout?: number;
  /**
   * Session isolation mode (default: "shared")
   *
   * - "shared": Single subprocess shared by all sessions (lower resource usage)
   * - "isolated": One subprocess per session (state isolation, higher resource usage)
   */
  readonly sessionMode?: "shared" | "isolated";
}

/**
 * MCP Server configuration (persisted to mcp.json)
 *
 * Contains only the static configuration needed to connect to a server.
 * Runtime metrics and health data are computed separately.
 */
export type McpServerConfig = HttpServerConfig | StdioServerConfig;

/**
 * Error details for crashed/stopped processes
 */
export interface ProcessError {
  message: string;
  code: string;
  timestamp: number;
}

/**
 * Process state for stdio servers (discriminated union)
 */
export type StdioProcessState =
  | {
      status: "running";
      pid: number;
      lastError: null;
      stderrLogs: string[];
    }
  | {
      status: "crashed";
      pid: null;
      lastError: ProcessError;
      stderrLogs: string[];
    }
  | {
      status: "stopped";
      pid: null;
      lastError: ProcessError | null;
      stderrLogs: string[];
    }
  | {
      status: "isolated";
      sessionCount: number;
      pid: null;
      lastError: null;
      stderrLogs: string[];
    };

/**
 * HTTP Server runtime state
 */
export interface HttpServer extends HttpServerConfig {
  /** Timestamp of last request (computed from logs table) */
  lastActivity: string | null;
  /** Total number of requests handled (computed from logs table) */
  exchangeCount: number;
  /** Current health status (persisted in server_health table) */
  health?: HealthStatus;
  /** Last health check timestamp (persisted in server_health table) */
  lastHealthCheck?: string;
  /** Timestamp of last health check in ms (persisted in server_health table) */
  lastCheckTime?: number;
  /** Timestamp of last successful health check in ms (persisted in server_health table) */
  lastHealthyTime?: number;
  /** Timestamp of last failed health check in ms (persisted in server_health table) */
  lastErrorTime?: number;
  /** Error message from last failed health check (persisted in server_health table) */
  errorMessage?: string;
  /** Error code from last failed health check (persisted in server_health table) */
  errorCode?: string;
  /** Response time from last successful health check in ms (persisted in server_health table) */
  responseTimeMs?: number;
}

/**
 * Stdio Server runtime state
 */
export interface StdioServer extends StdioServerConfig {
  /** Timestamp of last request (computed from logs table) */
  lastActivity: string | null;
  /** Total number of requests handled (computed from logs table) */
  exchangeCount: number;
  /** Process state (in-memory only) */
  processState: StdioProcessState;
  /** Current health status (persisted in server_health table) */
  health?: HealthStatus;
  /** Last health check timestamp (persisted in server_health table) */
  lastHealthCheck?: string;
  /** Timestamp of last health check in ms (persisted in server_health table) */
  lastCheckTime?: number;
  /** Timestamp of last successful health check in ms (persisted in server_health table) */
  lastHealthyTime?: number;
  /** Timestamp of last failed health check in ms (persisted in server_health table) */
  lastErrorTime?: number;
  /** Error message from last failed health check (persisted in server_health table) */
  errorMessage?: string;
  /** Error code from last failed health check (persisted in server_health table) */
  errorCode?: string;
}

/**
 * MCP Server configuration and runtime state
 *
 * **Field categories:**
 * - **Persisted (saved to mcp.json):** name, url/command/args, type, headers/env/cwd
 * - **Computed (derived from SQLite logs):** lastActivity, exchangeCount
 * - **Persisted (saved to SQLite server_health table):** health, lastHealthCheck, lastCheckTime, lastHealthyTime, lastErrorTime, errorMessage, errorCode, responseTimeMs (HTTP only), errorCode (HTTP only)
 * - **In-memory (stdio only):** processState
 *
 * Extends McpServerConfig with computed metrics and runtime state.
 */
export type McpServer = HttpServer | StdioServer;

// Type guards

/**
 * Check if config is for an HTTP server
 */
export function isHttpServerConfig(
  config: McpServerConfig,
): config is HttpServerConfig {
  return config.type === "http";
}

/**
 * Check if config is for a stdio server
 */
export function isStdioServerConfig(
  config: McpServerConfig,
): config is StdioServerConfig {
  return config.type === "stdio";
}

/**
 * Check if server is an HTTP server
 */
export function isHttpServer(server: McpServer): server is HttpServer {
  return server.type === "http";
}

/**
 * Check if server is a stdio server
 */
export function isStdioServer(server: McpServer): server is StdioServer {
  return server.type === "stdio";
}

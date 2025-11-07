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
 * MCP Server configuration (persisted to mcp.json)
 *
 * Contains only the static configuration needed to connect to a server.
 * Runtime metrics and health data are computed separately.
 */
export interface McpServerConfig {
  /** Server identifier (unique, persisted) */
  name: string;
  /** Server endpoint URL (persisted) */
  url: string;
  /** Protocol type (currently only "http" supported, persisted) */
  type: "http";
  /** HTTP headers to include with requests (persisted) */
  headers: Record<string, string>;
}

/**
 * MCP Server configuration and runtime state
 *
 * **Field categories:**
 * - **Persisted (saved to mcp.json):** name, url, type, headers
 * - **Computed (derived from SQLite logs):** lastActivity, exchangeCount
 * - **Persisted (saved to SQLite server_health table):** health, lastHealthCheck, lastCheckTime, lastHealthyTime, lastErrorTime, errorMessage, errorCode, responseTimeMs
 *
 * Extends McpServerConfig with computed metrics and runtime state.
 */
export interface McpServer extends McpServerConfig {
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

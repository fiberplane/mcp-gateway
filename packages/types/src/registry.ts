// Health status for servers
export type ServerHealth = "up" | "down" | "unknown";

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
 * - **Runtime-only (in-memory, reset on restart):** health, lastHealthCheck
 *
 * Extends McpServerConfig with computed metrics and runtime state.
 */
export interface McpServer extends McpServerConfig {
  /** Timestamp of last request (computed from logs table) */
  lastActivity: string | null;
  /** Total number of requests handled (computed from logs table) */
  exchangeCount: number;
  /** Current health status (runtime-only, not persisted) */
  health?: ServerHealth;
  /** Last health check timestamp (runtime-only, not persisted) */
  lastHealthCheck?: string;
}

export interface Registry {
  servers: McpServer[];
}

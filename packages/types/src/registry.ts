// Health status for servers
export type ServerHealth = "up" | "down" | "unknown";

/**
 * MCP Server configuration and runtime state
 *
 * **Field categories:**
 * - **Persisted (saved to mcp.json):** name, url, type, headers
 * - **Computed (derived from SQLite logs):** lastActivity, exchangeCount
 * - **Runtime-only (in-memory, reset on restart):** health, lastHealthCheck
 */
export interface McpServer {
  /** Server identifier (persisted) */
  name: string;
  /** Server endpoint URL (persisted) */
  url: string;
  /** Protocol type (persisted) */
  type: "http";
  /** HTTP headers to include with requests (persisted) */
  headers: Record<string, string>;
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

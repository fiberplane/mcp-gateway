// Health status for servers
export type ServerHealth = "up" | "down" | "unknown";

// Pure data types for MCP servers and registry
export interface McpServer {
  name: string;
  url: string;
  type: "http";
  headers: Record<string, string>;
  lastActivity: string | null;
  exchangeCount: number;
  health?: ServerHealth;
  lastHealthCheck?: string;
}

export interface Registry {
  servers: McpServer[];
}

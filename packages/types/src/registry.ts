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

// MCP protocol types

/**
 * Tool definition from MCP server
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
}

/**
 * Resource definition from MCP server
 */
export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Prompt definition from MCP server
 */
export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

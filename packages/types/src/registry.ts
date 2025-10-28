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
  authUrl?: string; // OAuth authorization URL (if server requires auth)
  authError?: string; // Error message from auth failure
  oauthClientId?: string; // Client ID from Dynamic Client Registration
  oauthClientSecret?: string; // Client secret from Dynamic Client Registration
  oauthToken?: string; // OAuth access token
  oauthTokenExpiresAt?: number; // Token expiry timestamp (seconds since epoch)
  oauthRefreshToken?: string; // OAuth refresh token
  isEvaluationServer?: boolean; // True if this is a temporary server for optimization evaluation
  evaluationOriginalServer?: string; // Original server name this evaluation server is based on
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

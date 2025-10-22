/**
 * Types matching the API responses
 */
import type {
  ApiLogEntry,
  ClientAggregation,
  LogQueryResult,
  ServerInfo,
  SessionInfo,
} from "@fiberplane/mcp-gateway-types";

// Re-export types from types package
export type { ClientAggregation, LogQueryResult, ServerInfo, SessionInfo };

// Type alias for convenience - use ApiLogEntry from types package
export type LogEntry = ApiLogEntry;

/**
 * API Client for MCP Gateway logs
 */
class APIClient {
  private baseURL = "/api";

  /**
   * Get logs with optional filters
   *
   * Returns ApiLogEntry records (transformed from CaptureRecords by the API).
   * Each CaptureRecord is split into separate request/response entries with a direction field.
   */
  async getLogs(params: {
    serverName?: string;
    clientName?: string;
    sessionId?: string;
    method?: string;
    after?: string;
    before?: string;
    limit?: number;
    order?: "asc" | "desc";
  }): Promise<{
    data: ApiLogEntry[];
    pagination: LogQueryResult["pagination"];
  }> {
    const url = new URL(`${this.baseURL}/logs`, window.location.origin);

    // Map frontend parameter names to API parameter names
    const paramMapping: Record<string, string> = {
      serverName: "server",
      clientName: "clientName",
      sessionId: "session",
    };

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        const apiKey = paramMapping[key] || key;
        url.searchParams.append(apiKey, String(value));
      }
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get list of servers with aggregations
   */
  async getServers(): Promise<{ servers: ServerInfo[] }> {
    const response = await fetch(`${this.baseURL}/servers`);
    if (!response.ok) {
      throw new Error(`Failed to fetch servers: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get list of sessions with aggregations
   */
  async getSessions(serverName?: string): Promise<{ sessions: SessionInfo[] }> {
    const url = new URL(`${this.baseURL}/sessions`, window.location.origin);
    if (serverName) {
      url.searchParams.append("server", serverName);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get list of clients with aggregations
   */
  async getClients(): Promise<{ clients: ClientAggregation[] }> {
    const response = await fetch(`${this.baseURL}/clients`);
    if (!response.ok) {
      throw new Error(`Failed to fetch clients: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Clear all session data (client info and server info)
   */
  async clearSessions(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseURL}/logs/clear`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Failed to clear sessions: ${response.statusText}`);
    }
    return response.json();
  }
}

/**
 * Singleton API client instance
 */
export const api = new APIClient();

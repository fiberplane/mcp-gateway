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
   *
   * String filters (serverName, clientName, sessionId, method) support arrays for multi-select.
   * Numeric filters (duration, tokens) support comparison operators (eq, gt, lt, gte, lte).
   * Arrays are sent as repeated query parameters (e.g., ?client=foo&client=bar).
   */
  async getLogs(params: {
    serverName?: string | string[];
    clientName?: string | string[];
    sessionId?: string | string[];
    method?: string | string[];
    durationEq?: number | number[];
    durationGt?: number;
    durationLt?: number;
    durationGte?: number;
    durationLte?: number;
    tokensEq?: number | number[];
    tokensGt?: number;
    tokensLt?: number;
    tokensGte?: number;
    tokensLte?: number;
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
      clientName: "client",
      sessionId: "session",
    };

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        const apiKey = paramMapping[key] || key;

        // Handle arrays by appending each value separately (creates repeated params)
        if (Array.isArray(value)) {
          for (const v of value) {
            url.searchParams.append(apiKey, String(v));
          }
        } else {
          url.searchParams.append(apiKey, String(value));
        }
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
   * Get list of methods
   */
  async getMethods(
    serverName?: string,
  ): Promise<{ methods: Array<{ method: string }> }> {
    const url = new URL(`${this.baseURL}/methods`, window.location.origin);
    if (serverName) {
      url.searchParams.append("server", serverName);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch methods: ${response.statusText}`);
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

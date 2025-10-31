/**
 * Types matching the API responses
 */
import type {
  ApiLogEntry,
  ClientAggregation,
  LogQueryResult,
  McpServer,
  McpServerConfig,
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
   * String filters support operator:value format (e.g., "contains:inspector" or "is:exact-match").
   * Numeric filters (duration, tokens) support comparison operators (eq, gt, lt, gte, lte).
   * Arrays are sent as repeated query parameters (e.g., ?client=contains:foo&client=contains:bar).
   * Search parameter (q) performs text search across request/response content.
   */
  async getLogs(params: {
    q?: string[];
    serverName?: string | string[]; // Format: "operator:value" or ["operator:value1", "operator:value2"]
    clientName?: string | string[]; // Format: "operator:value" or ["operator:value1", "operator:value2"]
    sessionId?: string | string[]; // Format: "operator:value" or ["operator:value1", "operator:value2"]
    method?: string | string[]; // Format: "operator:value" or ["operator:value1", "operator:value2"]
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

  /**
   * Get all server configurations with full details
   *
   * Returns complete server configurations including custom headers.
   * This is different from getServers() which returns aggregated stats.
   */
  async getServerConfigs(): Promise<{ servers: McpServer[] }> {
    const response = await fetch(`${this.baseURL}/servers/config`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch server configurations: ${response.statusText}`,
      );
    }
    return response.json();
  }

  /**
   * Add a new server to the registry
   *
   * @param config Server configuration (name, url, type, headers)
   * @returns Created server configuration
   */
  async addServer(
    config: McpServerConfig,
  ): Promise<{ success: boolean; server: McpServerConfig }> {
    const response = await fetch(`${this.baseURL}/servers/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `Failed to add server: ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Update an existing server configuration
   *
   * @param name Server name (normalized to lowercase)
   * @param changes Partial configuration to update (url and/or headers)
   * @returns Success confirmation
   */
  async updateServer(
    name: string,
    changes: Partial<Omit<McpServerConfig, "name" | "type">>,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseURL}/servers/config/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `Failed to update server: ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Delete a server from the registry
   *
   * Note: Associated logs are preserved for historical analysis
   *
   * @param name Server name (normalized to lowercase)
   * @returns Success confirmation
   */
  async deleteServer(
    name: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseURL}/servers/config/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `Failed to delete server: ${response.statusText}`,
      );
    }

    return response.json();
  }
}

/**
 * Singleton API client instance
 */
export const api = new APIClient();

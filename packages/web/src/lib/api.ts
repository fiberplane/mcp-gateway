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
  private authToken: string | null = null;

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get current authentication token (for display purposes)
   */
  getToken(): string {
    return this.authToken || "";
  }

  /**
   * Create fetch options with authentication header
   */
  private createAuthHeaders(options: RequestInit = {}): RequestInit {
    if (!this.authToken) {
      throw new Error("Authentication token not set. Call setToken() first.");
    }

    return {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.authToken}`,
      },
    };
  }

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

    const options = this.createAuthHeaders();
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get list of servers with aggregations
   */
  async getServers(): Promise<{ servers: ServerInfo[] }> {
    const options = await this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/servers`, options);
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

    const options = this.createAuthHeaders();
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get list of clients with aggregations
   */
  async getClients(): Promise<{ clients: ClientAggregation[] }> {
    const options = await this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/clients`, options);
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

    const options = this.createAuthHeaders();
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      throw new Error(`Failed to fetch methods: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Clear all session data (client info and server info)
   */
  async clearSessions(): Promise<{ success: boolean }> {
    const options = this.createAuthHeaders({
      method: "POST",
    });
    const response = await fetch(`${this.baseURL}/logs/clear`, options);
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
    const options = await this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/servers/config`, options);
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
    const options = this.createAuthHeaders({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    const response = await fetch(`${this.baseURL}/servers/config`, options);

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
    const options = this.createAuthHeaders({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    });

    const response = await fetch(
      `${this.baseURL}/servers/config/${encodeURIComponent(name)}`,
      options,
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
    const options = this.createAuthHeaders({
      method: "DELETE",
    });

    const response = await fetch(
      `${this.baseURL}/servers/config/${encodeURIComponent(name)}`,
      options,
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.message || `Failed to delete server: ${response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Manually trigger a health check for a server
   *
   * @param name Server name (normalized to lowercase)
   * @returns Updated server with health check results
   */
  async checkServerHealth(name: string): Promise<{ server: McpServer }> {
    const options = this.createAuthHeaders({
      method: "POST",
    });

    const response = await fetch(
      `${this.baseURL}/servers/${encodeURIComponent(name)}/health-check`,
      options,
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      // Extract error message: prioritize error.message, then error.error, then status text
      const errorMessage =
        (typeof error.message === "string" && error.message) ||
        (typeof error.error === "string" && error.error) ||
        response.statusText;
      throw new Error(`Failed to check server health: ${errorMessage}`);
    }

    return response.json();
  }
}

/**
 * Singleton API client instance
 */
export const api = new APIClient();

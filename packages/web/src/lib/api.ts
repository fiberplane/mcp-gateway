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
import { ApiError, UnauthorizedError } from "./errors.js";

/**
 * Public API interface - only includes public methods
 * This interface is what consumers of the API client should use
 */
export interface IApiClient {
  getLogs(params: {
    q?: string[];
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
  }>;

  getServers(): Promise<{ servers: ServerInfo[] }>;

  getSessions(serverName?: string): Promise<{ sessions: SessionInfo[] }>;

  getClients(): Promise<{ clients: ClientAggregation[] }>;

  getMethods(
    serverName?: string,
  ): Promise<{ methods: Array<{ method: string }> }>;

  clearSessions(): Promise<{ success: boolean }>;

  getServerConfigs(): Promise<{ servers: McpServer[] }>;

  addServer(
    config: McpServerConfig,
  ): Promise<{ success: boolean; server: McpServerConfig }>;

  updateServer(
    name: string,
    changes: Partial<Omit<McpServerConfig, "name" | "type">>,
  ): Promise<{ success: boolean; message: string }>;

  deleteServer(name: string): Promise<{ success: boolean; message: string }>;

  checkServerHealth(name: string): Promise<{ server: McpServer }>;
}

/**
 * API Client for MCP Gateway logs
 */
class APIClient implements IApiClient {
  private baseURL = "/api";

  /**
   * Create API client with token provider
   * @param getToken Function that returns the current auth token
   */
  constructor(private getToken: () => string | null) {}

  /**
   * Handle HTTP response and throw typed errors
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401) {
        throw new UnauthorizedError();
      }
      const errorText = await response.text().catch(() => response.statusText);
      throw new ApiError(errorText, response.status);
    }
    return response.json();
  }

  /**
   * Create fetch options with authentication header
   */
  private createAuthHeaders(options: RequestInit = {}): RequestInit {
    const token = this.getToken();
    if (!token) {
      throw new UnauthorizedError("Authentication token not set");
    }

    // Use Headers API for type-safe header merging
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);

    return {
      ...options,
      headers,
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
    return this.handleResponse<{
      data: ApiLogEntry[];
      pagination: LogQueryResult["pagination"];
    }>(response);
  }

  /**
   * Get list of servers with aggregations
   */
  async getServers(): Promise<{ servers: ServerInfo[] }> {
    const options = this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/servers`, options);
    return this.handleResponse<{ servers: ServerInfo[] }>(response);
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
    return this.handleResponse<{ sessions: SessionInfo[] }>(response);
  }

  /**
   * Get list of clients with aggregations
   */
  async getClients(): Promise<{ clients: ClientAggregation[] }> {
    const options = this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/clients`, options);
    return this.handleResponse<{ clients: ClientAggregation[] }>(response);
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
    return this.handleResponse<{ methods: Array<{ method: string }> }>(
      response,
    );
  }

  /**
   * Clear all session data (client info and server info)
   */
  async clearSessions(): Promise<{ success: boolean }> {
    const options = this.createAuthHeaders({
      method: "POST",
    });
    const response = await fetch(`${this.baseURL}/logs/clear`, options);
    return this.handleResponse<{ success: boolean }>(response);
  }

  /**
   * Get all server configurations with full details
   *
   * Returns complete server configurations including custom headers.
   * This is different from getServers() which returns aggregated stats.
   */
  async getServerConfigs(): Promise<{ servers: McpServer[] }> {
    const options = this.createAuthHeaders();
    const response = await fetch(`${this.baseURL}/servers/config`, options);
    return this.handleResponse<{ servers: McpServer[] }>(response);
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
      body: JSON.stringify(config),
    });

    // Manually set Content-Type since we're using Headers API
    (options.headers as Headers).set("Content-Type", "application/json");

    const response = await fetch(`${this.baseURL}/servers/config`, options);
    return this.handleResponse<{ success: boolean; server: McpServerConfig }>(
      response,
    );
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
      body: JSON.stringify(changes),
    });

    // Manually set Content-Type since we're using Headers API
    (options.headers as Headers).set("Content-Type", "application/json");

    const response = await fetch(
      `${this.baseURL}/servers/config/${encodeURIComponent(name)}`,
      options,
    );
    return this.handleResponse<{ success: boolean; message: string }>(response);
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
    return this.handleResponse<{ success: boolean; message: string }>(response);
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
    return this.handleResponse<{ server: McpServer }>(response);
  }

  /**
   * Restart a stdio server process
   *
   * Only works for stdio servers in shared mode.
   * Returns error if called on HTTP server or isolated mode stdio server.
   *
   * @param name Server name (normalized to lowercase)
   * @returns Success confirmation
   */
  async restartStdioServer(
    name: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseURL}/servers/${encodeURIComponent(name)}/restart`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      const errorMessage =
        (typeof error.message === "string" && error.message) ||
        (typeof error.error === "string" && error.error) ||
        response.statusText;
      throw new Error(`Failed to restart server: ${errorMessage}`);
    }

    return response.json();
  }
}

/**
 * Create an API client instance
 * @param getToken Function that returns the current auth token
 */
export function createApiClient(getToken: () => string | null): IApiClient {
  return new APIClient(getToken);
}

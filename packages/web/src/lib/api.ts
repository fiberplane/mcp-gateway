/**
 * Types matching the API responses
 */
export interface LogEntry {
  timestamp: string;
  method: string;
  id: string | number | null;
  direction: "request" | "response";
  metadata: {
    serverName: string;
    sessionId: string;
    durationMs: number;
    httpStatus: number;
    client?: {
      name: string;
      version: string;
      title?: string;
    };
    server?: {
      name: string;
      version: string;
      title?: string;
    };
    userAgent?: string;
    clientIp?: string;
  };
  request?: unknown;
  response?: unknown;
}

export interface LogQueryResult {
  data: LogEntry[];
  pagination: {
    count: number;
    limit: number;
    hasMore: boolean;
    oldestTimestamp: string | null;
    newestTimestamp: string | null;
  };
}

export interface ServerInfo {
  name: string;
  logCount: number;
  sessionCount: number;
}

export interface SessionInfo {
  sessionId: string;
  serverName: string;
  logCount: number;
  startTime: string;
  endTime: string;
}

export interface ClientAggregation {
  clientName: string;
  clientVersion: string | null;
  logCount: number;
  sessionCount: number;
}

/**
 * API Client for MCP Gateway logs
 */
class APIClient {
  private baseURL = "/api";

  /**
   * Get logs with optional filters
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
  }): Promise<LogQueryResult> {
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
}

/**
 * Singleton API client instance
 */
export const api = new APIClient();

import type { CaptureRecord } from "./schemas.js";

/**
 * Standard API error response
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Query options for log filtering and pagination
 */
export interface LogQueryOptions {
  serverName?: string;
  sessionId?: string;
  method?: string;
  after?: string; // ISO timestamp
  before?: string; // ISO timestamp
  limit?: number;
  order?: "asc" | "desc";
}

/**
 * Paginated query result
 */
export interface LogQueryResult {
  data: CaptureRecord[];
  pagination: {
    count: number;
    limit: number;
    hasMore: boolean;
    oldestTimestamp: string | null;
    newestTimestamp: string | null;
  };
}

/**
 * Server status determined by registry membership and health checks
 * - online: Server is in registry and responding to health checks (health = "up")
 * - offline: Server is in registry but failing health checks (health = "down")
 * - not-found: Server not in registry, health unknown, or imported from external source
 */
export type ServerStatus = "online" | "offline" | "not-found";

/**
 * Server aggregation info
 */
export interface ServerInfo {
  name: string;
  logCount: number;
  sessionCount: number;
  status: ServerStatus;
}

/**
 * Session aggregation info
 */
export interface SessionInfo {
  sessionId: string;
  serverName: string;
  logCount: number;
  startTime: string;
  endTime: string;
}

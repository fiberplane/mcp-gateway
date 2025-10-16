import type { CaptureRecord } from "./schemas.js";

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
 * Server aggregation info
 */
export interface ServerInfo {
  name: string;
  logCount: number;
  sessionCount: number;
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

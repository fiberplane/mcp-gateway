import type {
  CaptureMetadata,
  CaptureRecord,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./schemas.js";

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
 * API log entry - transformed from CaptureRecord
 *
 * The API endpoint splits CaptureRecords (which contain both request and response)
 * into separate entries with a direction field, making it easier for clients to
 * work with individual request/response pairs.
 */
export interface ApiLogEntry {
  timestamp: string;
  method: string;
  id: string | number | null;
  direction: "request" | "response";
  metadata: CaptureMetadata;
  request?: JsonRpcRequest;
  response?: JsonRpcResponse;
}

/**
 * Query options for log filtering and pagination
 */
export interface LogQueryOptions {
  serverName?: string;
  sessionId?: string;
  method?: string;
  clientName?: string; // Filter by client name
  clientVersion?: string; // Filter by client version
  clientIp?: string; // Filter by client IP
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

/**
 * Client aggregation info
 */
export interface ClientAggregation {
  clientName: string;
  clientVersion: string | null;
  logCount: number;
  sessionCount: number;
}

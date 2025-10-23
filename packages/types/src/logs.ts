import type {
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
 * The API endpoint transforms CaptureRecords into separate entries:
 * - Request/response pairs are split into individual entries with direction field
 * - SSE events are included as standalone entries with direction: "sse-event"
 *
 * This is a discriminated union where direction field determines which fields are present.
 */

/**
 * Request log entry (from CaptureRecord.request)
 */
export interface ApiRequestLogEntry
  extends Omit<CaptureRecord, "response" | "sseEvent"> {
  direction: "request";
  request: JsonRpcRequest;
}

/**
 * Response log entry (from CaptureRecord.response)
 */
export interface ApiResponseLogEntry
  extends Omit<CaptureRecord, "request" | "sseEvent"> {
  direction: "response";
  response: JsonRpcResponse;
}

/**
 * SSE event log entry (from CaptureRecord.sseEvent)
 */
export interface ApiSseEventLogEntry
  extends Omit<CaptureRecord, "request" | "response"> {
  direction: "sse-event";
  sseEvent: {
    id?: string;
    event?: string;
    data?: string;
    retry?: number;
  };
}

/**
 * Union type representing all possible API log entries
 */
export type ApiLogEntry =
  | ApiRequestLogEntry
  | ApiResponseLogEntry
  | ApiSseEventLogEntry;

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

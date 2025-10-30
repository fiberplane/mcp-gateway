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
 *
 * String fields support arrays for OR logic (e.g., serverName: ["a", "b"] matches logs from server "a" OR "b")
 * Numeric fields support comparison operators (gt, lt, eq, gte, lte)
 */
export interface LogQueryOptions {
  // Text search (searches across request/response content)
  searchQueries?: string[]; // Text search terms (AND logic - all terms must match)

  // String filters (support arrays for multi-select)
  serverName?: string | string[]; // Filter by server name(s) - supports multi-select
  sessionId?: string | string[]; // Filter by session ID(s) - supports multi-select
  method?: string | string[]; // Filter by method name(s) - supports multi-select with partial match
  clientName?: string | string[]; // Filter by client name(s) - supports multi-select
  clientVersion?: string; // Filter by client version - single value only
  clientIp?: string; // Filter by client IP - single value only

  // Numeric filters (duration in milliseconds)
  durationEq?: number | number[]; // Duration equals (supports array for OR logic)
  durationGt?: number; // Duration greater than
  durationLt?: number; // Duration less than
  durationGte?: number; // Duration greater than or equal
  durationLte?: number; // Duration less than or equal

  // Numeric filters (tokens - sum of input + output)
  tokensEq?: number | number[]; // Total tokens equals (supports array for OR logic)
  tokensGt?: number; // Total tokens greater than
  tokensLt?: number; // Total tokens less than
  tokensGte?: number; // Total tokens greater than or equal
  tokensLte?: number; // Total tokens less than or equal

  // Time range filters
  after?: string; // ISO timestamp
  before?: string; // ISO timestamp

  // Pagination
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
  status: ServerStatus;
}

/**
 * Session aggregation info
 */
export interface SessionInfo {
  sessionId: string;
  serverName: string;
  startTime: string;
  endTime: string;
}

/**
 * Client aggregation info
 */
export interface ClientAggregation {
  clientName: string;
  clientVersion: string | null;
}

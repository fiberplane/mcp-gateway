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
 * String filter with operator support
 */
export interface StringFilter {
  operator: "is" | "contains";
  value: string | string[];
}

/**
 * Query options for log filtering and pagination
 *
 * String fields support arrays for OR logic and operators ("is" for exact match, "contains" for partial match)
 * Numeric fields support comparison operators (gt, lt, eq, gte, lte)
 *
 * For backward compatibility, string filter fields also accept plain strings (treated as exact match)
 */
export interface LogQueryOptions {
  // Text search (searches across request/response content)
  searchQueries?: string[]; // Text search terms (AND logic - all terms must match)

  // String filters (support arrays for multi-select and operators)
  // Also accept plain strings for backward compatibility (treated as exact match with "is" operator)
  serverName?: string | StringFilter; // Filter by server name(s) - supports "is" (exact) or "contains" (partial)
  sessionId?: string | StringFilter; // Filter by session ID(s) - supports "is" (exact) or "contains" (partial)
  method?: string | StringFilter; // Filter by method name(s) - supports "is" (exact) or "contains" (partial)
  clientName?: string | StringFilter; // Filter by client name(s) - supports "is" (exact) or "contains" (partial)
  clientVersion?: string; // Filter by client version - single value only (exact match)
  clientIp?: string; // Filter by client IP - single value only (exact match)

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
  url: string;
  /** Current health status (from server_health table) */
  health?: "up" | "down";
  /** Timestamp of last health check in ms (from server_health table) */
  lastCheckTime?: number;
  /** Timestamp of last successful health check in ms (from server_health table) */
  lastHealthyTime?: number;
  /** Timestamp of last failed health check in ms (from server_health table) */
  lastErrorTime?: number;
  /** Error message from last failed health check (from server_health table) */
  errorMessage?: string;
  /** Error code from last failed health check (from server_health table) */
  errorCode?: string;
  /** Response time from last successful health check in ms (from server_health table) */
  responseTimeMs?: number;
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

import type {
  CaptureRecord,
  ClientInfo,
  HttpContext,
  JsonRpcRequest,
  JsonRpcResponse,
  McpServerInfo,
  RequestTracker,
  SSEEvent,
} from "@fiberplane/mcp-gateway-types";
import {
  captureRecordSchema,
  clientInfoSchema,
  mcpServerInfoSchema,
} from "@fiberplane/mcp-gateway-types";
import { logger } from "../logger";

// Re-export types for backward compatibility
export type {
  HttpContext,
  RequestTracker,
  SSEEvent,
} from "@fiberplane/mcp-gateway-types";

// In-memory storage for client info by session
const sessionClientInfo = new Map<string, ClientInfo>();

// In-memory storage for server info by session
const sessionServerInfo = new Map<string, McpServerInfo>();

// Store request start times for duration calculation
const requestStartTimes = new Map<string | number, number>();

// Store request method by request ID (for matching responses to requests)
const requestMethods = new Map<string | number, string>();

// Store client info from initialize handshake
export function storeClientInfo(
  sessionId: string,
  clientInfo: ClientInfo,
): void {
  sessionClientInfo.set(sessionId, clientInfo);
}

// Get stored client info for session
export function getClientInfo(sessionId: string): ClientInfo | undefined {
  return sessionClientInfo.get(sessionId);
}

// Clear client info for session
export function clearClientInfo(sessionId: string): void {
  sessionClientInfo.delete(sessionId);
  sessionServerInfo.delete(sessionId);
}

// Get all active session IDs
export function getActiveSessions(): string[] {
  return Array.from(sessionClientInfo.keys()).filter(
    (id) => id !== "stateless",
  );
}

// Reset all capture state (for testing)
export function resetCaptureState(): void {
  sessionClientInfo.clear();
  requestStartTimes.clear();
  requestMethods.clear();
}

function sanitizeClientInfo(info?: ClientInfo): ClientInfo | undefined {
  if (!info) {
    return undefined;
  }

  const result = clientInfoSchema.safeParse(info);
  if (!result.success) {
    logger.debug("Discarding invalid client info for capture record", {
      issues: result.error.issues,
    });
    return undefined;
  }

  return result.data;
}

function sanitizeServerInfo(info?: McpServerInfo): McpServerInfo | undefined {
  if (!info) {
    return undefined;
  }

  const result = mcpServerInfoSchema.safeParse(info);
  if (!result.success) {
    logger.debug("Discarding invalid server info for capture record", {
      issues: result.error.issues,
    });
    return undefined;
  }

  return result.data;
}

function getStoredServerInfo(sessionId: string): McpServerInfo | undefined {
  return sessionServerInfo.get(sessionId);
}

// Create capture record for request only
export function createRequestCaptureRecord(
  serverName: string,
  sessionId: string,
  request: JsonRpcRequest,
  httpContext?: HttpContext,
  clientInfo?: ClientInfo,
  serverInfo?: McpServerInfo,
  requestTracker?: RequestTracker,
): CaptureRecord {
  const client = sanitizeClientInfo(clientInfo ?? getClientInfo(sessionId));
  const server = sanitizeServerInfo(serverInfo);

  if (client) {
    sessionClientInfo.set(sessionId, client);
  }

  if (server) {
    sessionServerInfo.set(sessionId, server);
  }

  // Store start time and method if request expects response (has id)
  if (request.id != null) {
    if (requestTracker) {
      requestTracker.trackRequest(request.id, request.method);
    } else {
      requestStartTimes.set(request.id, Date.now());
      requestMethods.set(request.id, request.method);
    }
  }

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method: request.method,
    id: request.id ?? null,
    metadata: {
      serverName,
      sessionId,
      durationMs: 0, // Unknown at request time
      httpStatus: 0, // Unknown at request time
      client,
      server,
      userAgent: httpContext?.userAgent,
      clientIp: httpContext?.clientIp,
    },
    request,
  };

  // Validate the record
  const result = captureRecordSchema.safeParse(record);
  if (!result.success) {
    logger.warn("Invalid capture record", { error: result.error });
    throw new Error("Failed to create valid capture record");
  }

  return record;
}

// Create capture record for response only
export function createResponseCaptureRecord(
  serverName: string,
  sessionId: string,
  response: JsonRpcResponse,
  httpStatus: number,
  method: string,
  httpContext?: HttpContext,
  clientInfo?: ClientInfo,
  serverInfo?: McpServerInfo,
  requestTracker?: RequestTracker,
): CaptureRecord {
  const client = sanitizeClientInfo(clientInfo ?? getClientInfo(sessionId));
  const server = sanitizeServerInfo(
    serverInfo ?? getStoredServerInfo(sessionId),
  );

  if (client) {
    sessionClientInfo.set(sessionId, client);
  }

  if (server) {
    sessionServerInfo.set(sessionId, server);
  }

  // Calculate duration and cleanup if we tracked the request
  let durationMs = 0;
  if (response.id != null) {
    if (requestTracker?.hasRequest(response.id)) {
      durationMs = requestTracker.calculateDuration(response.id);
    } else if (requestStartTimes.has(response.id)) {
      const startTime = requestStartTimes.get(response.id);
      if (startTime !== undefined) {
        durationMs = Date.now() - startTime;
        requestStartTimes.delete(response.id);
        requestMethods.delete(response.id);
      }
    }
  }

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method,
    id: response.id,
    metadata: {
      serverName,
      sessionId,
      durationMs,
      httpStatus,
      client,
      server,
      userAgent: httpContext?.userAgent,
      clientIp: httpContext?.clientIp,
    },
    response,
  };

  // Validate the record
  const result = captureRecordSchema.safeParse(record);
  if (!result.success) {
    logger.warn("Invalid capture record", { error: result.error });
    throw new Error("Failed to create valid capture record");
  }

  return record;
}

/**
 * @deprecated This function uses global state and is deprecated.
 * Use Gateway.capture.append() instead.
 *
 * This function will be removed in a future version.
 */
export async function appendCapture(
  _storageDir: string,
  _record: CaptureRecord,
): Promise<string> {
  throw new Error(
    "appendCapture() is deprecated. Use Gateway.capture.append() instead. " +
      "Create a Gateway instance via createGateway() and use its capture methods.",
  );
}

/**
 * @deprecated This function uses global state and is deprecated.
 * Use Gateway.capture.error() instead.
 *
 * This function will be removed in a future version.
 */
export async function captureError(
  _storageDir: string,
  _serverName: string,
  _sessionId: string,
  _request: JsonRpcRequest,
  _error: { code: number; message: string; data?: unknown },
  _httpStatus: number,
  _durationMs: number,
): Promise<void> {
  throw new Error(
    "captureError() is deprecated. Use Gateway.capture.error() instead. " +
      "Create a Gateway instance via createGateway() and use its capture methods.",
  );
}

// Create capture record for SSE event
export function createSSEEventCaptureRecord(
  serverName: string,
  sessionId: string,
  sseEvent: SSEEvent,
  method?: string,
  requestId?: string | number | null,
  httpContext?: HttpContext,
  clientInfo?: ClientInfo,
): CaptureRecord {
  const client = sanitizeClientInfo(clientInfo ?? getClientInfo(sessionId));
  if (client) {
    sessionClientInfo.set(sessionId, client);
  }

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method: method || "sse-event",
    id: requestId ?? null,
    metadata: {
      serverName,
      sessionId,
      durationMs: 0, // SSE events don't have request/response timing
      httpStatus: 200, // SSE events are part of successful streaming response
      client,
      userAgent: httpContext?.userAgent,
      clientIp: httpContext?.clientIp,
      sseEventId: sseEvent.id,
      sseEventType: sseEvent.event,
    },
    sseEvent: {
      id: sseEvent.id,
      event: sseEvent.event,
      data: sseEvent.data,
      retry: sseEvent.retry,
    },
  };

  // Validate the record
  const result = captureRecordSchema.safeParse(record);
  if (!result.success) {
    logger.warn("Invalid SSE capture record", { error: result.error });
    throw new Error("Failed to create valid SSE capture record");
  }

  return record;
}

export function resolveJsonRpcMethod(
  jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
  requestTracker?: RequestTracker,
): string {
  if ("method" in jsonRpcMessage) {
    return jsonRpcMessage.method;
  }
  if (jsonRpcMessage.id != null) {
    if (requestTracker) {
      return requestTracker.getMethod(jsonRpcMessage.id) ?? "unknown";
    }
    return requestMethods.get(jsonRpcMessage.id) ?? "unknown";
  }
  return "unknown";
}

// Create capture record for JSON-RPC message from SSE
export function createSSEJsonRpcCaptureRecord(
  serverName: string,
  sessionId: string,
  jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
  sseEvent: SSEEvent,
  isResponse: boolean = false,
  httpContext?: HttpContext,
  clientInfo?: ClientInfo,
  serverInfo?: McpServerInfo,
  requestTracker?: RequestTracker,
): CaptureRecord {
  const client = sanitizeClientInfo(clientInfo ?? getClientInfo(sessionId));
  const server = sanitizeServerInfo(
    serverInfo ?? getStoredServerInfo(sessionId),
  );

  if (client) {
    sessionClientInfo.set(sessionId, client);
  }

  if (server) {
    sessionServerInfo.set(sessionId, server);
  }

  const method = resolveJsonRpcMethod(jsonRpcMessage, requestTracker);

  // Store start time and method for requests
  if (!isResponse && jsonRpcMessage.id != null) {
    if (requestTracker) {
      if ("method" in jsonRpcMessage) {
        requestTracker.trackRequest(jsonRpcMessage.id, jsonRpcMessage.method);
      }
    } else {
      requestStartTimes.set(jsonRpcMessage.id, Date.now());
      if ("method" in jsonRpcMessage) {
        requestMethods.set(jsonRpcMessage.id, jsonRpcMessage.method);
      }
    }
  }

  // Calculate duration and cleanup for responses
  let durationMs = 0;
  if (isResponse && jsonRpcMessage.id != null) {
    if (requestTracker?.hasRequest(jsonRpcMessage.id)) {
      durationMs = requestTracker.calculateDuration(jsonRpcMessage.id);
    } else if (requestStartTimes.has(jsonRpcMessage.id)) {
      const startTime = requestStartTimes.get(jsonRpcMessage.id);
      if (startTime !== undefined) {
        durationMs = Date.now() - startTime;
        requestStartTimes.delete(jsonRpcMessage.id);
        requestMethods.delete(jsonRpcMessage.id);
      }
    }
  }

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method,
    id: jsonRpcMessage.id ?? null,
    metadata: {
      serverName,
      sessionId,
      durationMs,
      httpStatus: 200,
      client,
      server,
      userAgent: httpContext?.userAgent,
      clientIp: httpContext?.clientIp,
      sseEventId: sseEvent.id,
      sseEventType: sseEvent.event,
    },
    sseEvent: {
      id: sseEvent.id,
      event: sseEvent.event,
      data: sseEvent.data,
      retry: sseEvent.retry,
    },
  };

  if (isResponse) {
    record.response = jsonRpcMessage as JsonRpcResponse;
  } else {
    record.request = jsonRpcMessage as JsonRpcRequest;
  }

  // Validate the record
  const result = captureRecordSchema.safeParse(record);
  if (!result.success) {
    logger.warn("Invalid SSE JSON-RPC capture record", { error: result.error });
    throw new Error("Failed to create valid SSE JSON-RPC capture record");
  }

  return record;
}

/**
 * @deprecated This function uses global state and is deprecated.
 * Use Gateway.capture.sseEvent() instead.
 *
 * This function will be removed in a future version.
 */
export async function captureSSEEvent(
  _storageDir: string,
  _serverName: string,
  _sessionId: string,
  _sseEvent: SSEEvent,
  _method?: string,
  _requestId?: string | number | null,
): Promise<void> {
  throw new Error(
    "captureSSEEvent() is deprecated. Use Gateway.capture.sseEvent() instead. " +
      "Create a Gateway instance via createGateway() and use its capture methods.",
  );
}

/**
 * @deprecated This function uses global state and is deprecated.
 * Use Gateway.capture.sseJsonRpc() instead.
 *
 * This function will be removed in a future version.
 */
export async function captureSSEJsonRpc(
  _storageDir: string,
  _serverName: string,
  _sessionId: string,
  _jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
  _sseEvent: SSEEvent,
  _isResponse: boolean = false,
): Promise<CaptureRecord | null> {
  throw new Error(
    "captureSSEJsonRpc() is deprecated. Use Gateway.capture.sseJsonRpc() instead. " +
      "Create a Gateway instance via createGateway() and use its capture methods.",
  );
}

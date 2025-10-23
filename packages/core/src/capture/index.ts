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

// Store request start times for duration calculation (fallback when RequestTracker not provided)
const requestStartTimes = new Map<string | number, number>();

// Store request method by request ID (for matching responses to requests)
const requestMethods = new Map<string | number, string>();

// Reset all capture state (for testing)
export function resetCaptureState(): void {
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
  const client = sanitizeClientInfo(clientInfo);
  const server = sanitizeServerInfo(serverInfo);

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
  const client = sanitizeClientInfo(clientInfo);
  const server = sanitizeServerInfo(serverInfo);

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
  const client = sanitizeClientInfo(clientInfo);

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
  const client = sanitizeClientInfo(clientInfo);
  const server = sanitizeServerInfo(serverInfo);

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

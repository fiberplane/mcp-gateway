import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../logger";
import type {
  CaptureRecord,
  ClientInfo,
  JsonRpcRequest,
  JsonRpcResponse,
} from "@fiberplane/mcp-gateway-types";
import { captureRecordSchema, generateCaptureFilename } from "@fiberplane/mcp-gateway-types";
import type { SSEEvent } from "./sse-parser";
import { ensureServerCaptureDir } from "../registry/storage";

// In-memory storage for client info by session
const sessionClientInfo = new Map<string, ClientInfo>();

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
}

// Get all active session IDs
export function getActiveSessions(): string[] {
  return Array.from(sessionClientInfo.keys()).filter(
    (id) => id !== "stateless",
  );
}

// Create capture record for request only
export function createRequestCaptureRecord(
  serverName: string,
  sessionId: string,
  request: JsonRpcRequest,
): CaptureRecord {
  const clientInfo = getClientInfo(sessionId);

  // Store start time and method if request expects response (has id)
  if (request.id != null) {
    requestStartTimes.set(request.id, Date.now());
    requestMethods.set(request.id, request.method);
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
      client: clientInfo,
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
): CaptureRecord {
  const clientInfo = getClientInfo(sessionId);

  // Calculate duration and cleanup if we tracked the request
  let durationMs = 0;
  if (response.id != null && requestStartTimes.has(response.id)) {
    const startTime = requestStartTimes.get(response.id);
    if (startTime !== undefined) {
      durationMs = Date.now() - startTime;
      requestStartTimes.delete(response.id);
      requestMethods.delete(response.id);
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
      client: clientInfo,
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

export async function appendCapture(
  storageDir: string,
  record: CaptureRecord,
): Promise<string> {
  // Generate filename (one per session)
  let filePath: string = "unknown";

  try {
    const filename = generateCaptureFilename(
      record.metadata.serverName,
      record.metadata.sessionId,
    );

    filePath = join(storageDir, record.metadata.serverName, filename);

    // Ensure server capture directory exists
    await ensureServerCaptureDir(storageDir, record.metadata.serverName);

    // Append JSONL record to file
    const jsonLine = `${JSON.stringify(record)}\n`;

    // Use Node.js fs to append content
    let existingContent = "";
    try {
      await access(filePath, constants.F_OK);
      // Type assertion needed: Bun's readFile with "utf8" encoding returns string, not Buffer
      existingContent = await readFile(filePath, "utf8") as unknown as string;
    } catch {
      // File doesn't exist, start with empty content
    }

    await writeFile(filePath, existingContent + jsonLine, "utf8");
    return filename;
  } catch (error) {
    logger.error("Failed to append capture record", {
      error:
        error instanceof Error
          ? {
            message: error.message,
            stack: error.stack,
          }
          : String(error),
      filePath,
    });
    throw new Error(
      `Capture storage failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Error handling for failed requests
export async function captureError(
  storageDir: string,
  serverName: string,
  sessionId: string,
  request: JsonRpcRequest,
  error: { code: number; message: string; data?: unknown },
  httpStatus: number,
  durationMs: number,
): Promise<void> {
  // Only capture error response if request expected a response
  if (request.id == null) {
    return; // Notification errors aren't sent back
  }

  const errorResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: request.id,
    error,
  };

  const record = createResponseCaptureRecord(
    serverName,
    sessionId,
    errorResponse,
    httpStatus,
    request.method,
  );

  // Override the calculated duration with the provided one
  record.metadata.durationMs = durationMs;

  await appendCapture(storageDir, record);
}

// Create capture record for SSE event
export function createSSEEventCaptureRecord(
  serverName: string,
  sessionId: string,
  sseEvent: SSEEvent,
  method?: string,
  requestId?: string | number | null,
): CaptureRecord {
  const clientInfo = getClientInfo(sessionId);

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method: method || "sse-event",
    id: requestId ?? null,
    metadata: {
      serverName,
      sessionId,
      durationMs: 0, // SSE events don't have request/response timing
      httpStatus: 200, // SSE events are part of successful streaming response
      client: clientInfo,
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

function resolveJsonRpcMethod(
  jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
): string {
  if ("method" in jsonRpcMessage) {
    return jsonRpcMessage.method;
  }
  if (jsonRpcMessage.id != null) {
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
): CaptureRecord {
  const clientInfo = getClientInfo(sessionId);

  const method = resolveJsonRpcMethod(jsonRpcMessage);

  // Store start time and method for requests
  if (!isResponse && jsonRpcMessage.id != null) {
    requestStartTimes.set(jsonRpcMessage.id, Date.now());
    if ("method" in jsonRpcMessage) {
      requestMethods.set(jsonRpcMessage.id, jsonRpcMessage.method);
    }
  }

  // Calculate duration and cleanup for responses
  let durationMs = 0;
  if (isResponse && jsonRpcMessage.id != null) {
    if (requestStartTimes.has(jsonRpcMessage.id)) {
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
      client: clientInfo,
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

// Capture SSE event (wrapper for appendCapture)
export async function captureSSEEvent(
  storageDir: string,
  serverName: string,
  sessionId: string,
  sseEvent: SSEEvent,
  method?: string,
  requestId?: string | number | null,
): Promise<void> {
  try {
    const record = createSSEEventCaptureRecord(
      serverName,
      sessionId,
      sseEvent,
      method,
      requestId,
    );
    await appendCapture(storageDir, record);
  } catch (error) {
    logger.error("Failed to capture SSE event", { error: String(error) });
    // Don't throw - SSE capture failures shouldn't break streaming
  }
}

// Capture JSON-RPC message from SSE
export async function captureSSEJsonRpc(
  storageDir: string,
  serverName: string,
  sessionId: string,
  jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
  sseEvent: SSEEvent,
  isResponse: boolean = false,
): Promise<CaptureRecord | null> {
  try {
    const record = createSSEJsonRpcCaptureRecord(
      serverName,
      sessionId,
      jsonRpcMessage,
      sseEvent,
      isResponse,
    );
    await appendCapture(storageDir, record);
    return record;
  } catch (error) {
    logger.error("Failed to capture SSE JSON-RPC", { error: String(error) });
    // Don't throw - SSE capture failures shouldn't break streaming
    return null;
  }
}

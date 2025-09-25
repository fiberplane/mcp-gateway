import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  CaptureRecord,
  ClientInfo,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./schemas.js";
import { captureRecordSchema, generateCaptureFilename } from "./schemas.js";
import { ensureServerCaptureDir } from "./storage.js";

// In-memory storage for client info by session
const sessionClientInfo = new Map<string, ClientInfo>();

// Store request start times for duration calculation
const requestStartTimes = new Map<string | number, number>();

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

  // Store start time if request expects response (has id)
  if (request.id != null) {
    requestStartTimes.set(request.id, Date.now());
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
    console.warn("Invalid capture record:", result.error);
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

  // Calculate duration if we tracked the request
  let durationMs = 0;
  if (response.id != null && requestStartTimes.has(response.id)) {
    const startTime = requestStartTimes.get(response.id);
    if (startTime !== undefined) {
      durationMs = Date.now() - startTime;
      requestStartTimes.delete(response.id);
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
    console.warn("Invalid capture record:", result.error);
    throw new Error("Failed to create valid capture record");
  }

  return record;
}

export async function appendCapture(
  storageDir: string,
  record: CaptureRecord,
): Promise<string> {
  try {
    // Ensure server capture directory exists
    await ensureServerCaptureDir(storageDir, record.metadata.serverName);

    // Generate filename (one per session)
    const filename = generateCaptureFilename(
      record.metadata.serverName,
      record.metadata.sessionId,
    );

    const filePath = join(storageDir, record.metadata.serverName, filename);

    // Append JSONL record to file
    const jsonLine = `${JSON.stringify(record)}\n`;

    // Use Node.js fs to append content
    let existingContent = "";
    try {
      await access(filePath, constants.F_OK);
      existingContent = await readFile(filePath, "utf8");
    } catch {
      // File doesn't exist, start with empty content
    }

    await writeFile(filePath, existingContent + jsonLine, "utf8");
    return filename;
  } catch (error) {
    console.error("Failed to append capture record:", error);
    throw new Error(`Capture storage failed: ${error}`);
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

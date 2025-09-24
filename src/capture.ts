import { join } from "node:path";
import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
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

// Create capture record
export function createCaptureRecord(
  serverName: string,
  sessionId: string,
  request: JsonRpcRequest,
  response: JsonRpcResponse,
  durationMs: number,
  httpStatus: number,
): CaptureRecord {
  const clientInfo = getClientInfo(sessionId);

  const record: CaptureRecord = {
    timestamp: new Date().toISOString(),
    method: request.method,
    id: request.id ?? null, // Handle missing id for notifications
    metadata: {
      serverName,
      sessionId,
      durationMs,
      httpStatus,
      client: clientInfo,
    },
    request,
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

// Append capture record to JSONL file
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
  const errorResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: request.id ?? null,
    error,
  };

  const record = createCaptureRecord(
    serverName,
    sessionId,
    request,
    errorResponse,
    durationMs,
    httpStatus,
  );

  await appendCapture(storageDir, record);
}

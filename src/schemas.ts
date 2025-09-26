import { z } from "zod";

// JSON-RPC schemas
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(), // Optional for notifications
  method: z.string(),
  params: z.unknown().optional(),
});

export const jsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

// Client info from MCP initialize handshake
export const clientInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  title: z.string().optional(),
});

// Tool call metadata
export const captureMetadataSchema = z.object({
  serverName: z.string(),
  sessionId: z.string(),
  durationMs: z.number(),
  httpStatus: z.number(),
  client: clientInfoSchema.optional(),
  sseEventId: z.string().optional(), // For SSE events
  sseEventType: z.string().optional(), // For SSE events
});

// Capture record for JSONL storage
export const captureRecordSchema = z.object({
  timestamp: z.string(), // ISO 8601 UTC
  method: z.string(), // JSON-RPC method
  id: z.union([z.string(), z.number(), z.null()]), // JSON-RPC request id (null for notifications)
  metadata: captureMetadataSchema,
  request: jsonRpcRequestSchema.optional(),
  response: jsonRpcResponseSchema.optional(),
  sseEvent: z.object({
    id: z.string().optional(),
    event: z.string().optional(),
    data: z.string().optional(),
    retry: z.number().optional(),
  }).optional(), // For SSE events
});

// Sanitize string for filesystem use
export function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

// In-memory cache to track when sessions started
const sessionStartTimes = new Map<string, string>();

// Generate session filename (one file per session with start timestamp)
export function generateCaptureFilename(
  serverName: string,
  sessionId: string,
): string {
  const sanitizedServerName = sanitizeForFilename(serverName);
  const sanitizedSessionId = sanitizeForFilename(sessionId);

  // Use cached start time for both regular sessions and stateless requests
  const sessionKey = `${serverName}-${sessionId}`;
  if (!sessionStartTimes.has(sessionKey)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    sessionStartTimes.set(sessionKey, timestamp);
  }

  const sessionStartTime = sessionStartTimes.get(sessionKey);
  if (!sessionStartTime) {
    throw new Error(`Session start time not found for ${sessionKey}`);
  }
  return `${sessionStartTime}-${sanitizedServerName}-${sanitizedSessionId}.jsonl`;
}

// Route parameter validation
export const serverParamSchema = z.object({
  server: z.string().min(1),
});

// Header validation for MCP session
export const sessionHeaderSchema = z
  .object({
    "mcp-session-id": z.string().optional(),
    "Mcp-Session-Id": z.string().optional(),
    "content-type": z.string().optional(),
    "MCP-Protocol-Version": z.string().optional(),
    "x-forwarded-for": z.string().optional(),
    "x-real-ip": z.string().optional(),
    "cf-connecting-ip": z.string().optional(),
  })
  .loose();

// Extract remote address using Zod-validated headers
export function extractRemoteAddress(
  headers: z.infer<typeof sessionHeaderSchema>,
): string {
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];
  const cfConnectingIp = headers["cf-connecting-ip"];

  return (
    forwarded?.split(",")[0]?.trim() || realIp || cfConnectingIp || "unknown"
  );
}

// Type exports
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;
export type ClientInfo = z.infer<typeof clientInfoSchema>;
export type CaptureMetadata = z.infer<typeof captureMetadataSchema>;
export type CaptureRecord = z.infer<typeof captureRecordSchema>;
export type ServerParam = z.infer<typeof serverParamSchema>;

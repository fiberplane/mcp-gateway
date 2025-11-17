import { z } from "zod";

// JSON-RPC schemas
// Requests always have a method field
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(), // Optional for notifications
  method: z.string(), // Required for requests
  params: z.unknown().optional(),
});

// Responses never have a method field, only result or error
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

// Type guard to differentiate requests from responses
export const isJsonRpcRequest = (
  jsonRpcMessage: JsonRpcRequest | JsonRpcResponse,
): jsonRpcMessage is JsonRpcRequest => {
  return (
    "method" in jsonRpcMessage && typeof jsonRpcMessage.method === "string"
  );
};

// Union type for validating either request or response
export const jsonRpcReqResSchema = z.union([
  jsonRpcRequestSchema,
  jsonRpcResponseSchema,
]);

// Client info from MCP initialize handshake
export const clientInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  title: z.string().optional(),
});

// Server info from MCP initialize response
export const mcpServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  title: z.string().optional(),
});

// MCP method parameter schemas (for parsing and validation)
export const toolsCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.unknown().optional(),
});

export const resourcesReadParamsSchema = z.object({
  uri: z.string(),
});

export const promptsGetParamsSchema = z.object({
  name: z.string(),
  arguments: z.unknown().optional(),
});

// Tool call metadata
export const captureMetadataSchema = z.object({
  serverName: z.string(),
  sessionId: z.string(),
  durationMs: z.number(),
  httpStatus: z.number(),
  client: clientInfoSchema.optional(),
  server: mcpServerInfoSchema.optional(),
  userAgent: z.string().optional(),
  clientIp: z.string().optional(),
  sseEventId: z.string().optional(), // For SSE events
  sseEventType: z.string().optional(), // For SSE events
  inputTokens: z.number().optional(), // Estimated tokens for request
  outputTokens: z.number().optional(), // Estimated tokens for response
  methodDetail: z.string().nullable().optional(), // Human-readable method detail for display
});

// Capture record stored in SQLite database
export const captureRecordSchema = z.object({
  timestamp: z.string(), // ISO 8601 UTC
  method: z.string(), // JSON-RPC method
  id: z.union([z.string(), z.number(), z.null()]), // JSON-RPC request id (null for notifications)
  metadata: captureMetadataSchema,
  request: jsonRpcRequestSchema.optional(),
  response: jsonRpcResponseSchema.optional(),
  sseEvent: z
    .object({
      id: z.string().optional(),
      event: z.string().optional(),
      data: z.string().optional(),
      retry: z.number().optional(),
    })
    .optional(), // For SSE events
});

// Sanitize string for filesystem use
export function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}

// Route parameter validation
export const serverParamSchema = z.object({
  server: z.string().min(1),
  prefix: z.string().optional(), // "servers" or "s" from URL path
});

// Header validation for MCP session
export const sessionHeaderSchema = z
  .object({
    "mcp-session-id": z.string().optional(),
    "Mcp-Session-Id": z.string().optional(),
    "x-session-id": z.string().optional(),
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

// Server configuration schemas
export const httpServerConfigSchema = z.object({
  name: z.string().min(1),
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()),
});

export const stdioServerConfigSchema = z.object({
  name: z.string().min(1),
  type: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().positive().optional(),
  sessionMode: z.enum(["shared", "isolated"]).optional(),
});

export const mcpServerConfigSchema = z.union([
  httpServerConfigSchema,
  stdioServerConfigSchema,
]);

// Type exports
export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;
export type ClientInfo = z.infer<typeof clientInfoSchema>;
export type McpServerInfo = z.infer<typeof mcpServerInfoSchema>;
export type ToolsCallParams = z.infer<typeof toolsCallParamsSchema>;
export type ResourcesReadParams = z.infer<typeof resourcesReadParamsSchema>;
export type PromptsGetParams = z.infer<typeof promptsGetParamsSchema>;
export type CaptureMetadata = z.infer<typeof captureMetadataSchema>;
export type CaptureRecord = z.infer<typeof captureRecordSchema>;
export type ServerParam = z.infer<typeof serverParamSchema>;

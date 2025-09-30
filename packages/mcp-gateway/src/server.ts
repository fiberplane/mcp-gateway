import { rename } from "node:fs/promises";
import { join } from "node:path";
import { sValidator } from "@hono/standard-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import type { z } from "zod";
import {
  appendCapture,
  captureError,
  captureSSEEvent,
  captureSSEJsonRpc,
  createRequestCaptureRecord,
  createResponseCaptureRecord,
  getClientInfo,
  storeClientInfo,
} from "./capture.js";
import { createMcpApp } from "./mcp-server.js";
import { getServer, type McpServer, type Registry } from "./registry.js";
import {
  clientInfoSchema,
  generateCaptureFilename,
  type JsonRpcRequest,
  type JsonRpcResponse,
  jsonRpcRequestSchema,
  serverParamSchema,
  sessionHeaderSchema,
} from "./schemas.js";
import {
  createSSEEventStream,
  isJsonRpcResponse,
  parseJsonRpcFromSSE,
} from "./sse-parser.js";
import { getStorageRoot, loadRegistry, saveRegistry } from "./storage.js";
import { emitLog, emitRegistryUpdate } from "./tui/events.js";
import type { LogEntry } from "./tui/state.js";

// Helper: Extract session ID from headers
function extractSessionId(
  validatedHeaders: z.infer<typeof sessionHeaderSchema>,
): string {
  return (
    validatedHeaders["Mcp-Session-Id"] ||
    validatedHeaders["mcp-session-id"] ||
    "stateless"
  );
}

// Helper: Build proxy headers
function buildProxyHeaders(
  c: Context,
  server: McpServer,
): Record<string, string> {
  const proxyHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version":
      c.req.raw.headers.get("MCP-Protocol-Version") || "2025-06-18",
    "Mcp-Session-Id":
      c.req.raw.headers.get("Mcp-Session-Id") ||
      c.req.raw.headers.get("mcp-session-id") ||
      "",
    ...server.headers,
  };

  const acceptHeader = c.req.raw.headers.get("Accept");
  if (acceptHeader) {
    proxyHeaders.Accept = acceptHeader;
  }

  return proxyHeaders;
}

// Helper: Handle client info from initialize
function handleInitializeClientInfo(
  sessionId: string,
  jsonRpcRequest: JsonRpcRequest,
): void {
  if (jsonRpcRequest.method === "initialize" && jsonRpcRequest.params) {
    const params = jsonRpcRequest.params as Record<string, unknown>;
    if (params.clientInfo) {
      const clientResult = clientInfoSchema.safeParse(params.clientInfo);
      if (clientResult.success) {
        storeClientInfo(sessionId, clientResult.data);
      }
    }
  }
}

// Helper: Update server activity
async function updateServerActivity(
  storage: string,
  registry: Registry,
  server: McpServer,
): Promise<void> {
  server.lastActivity = new Date().toISOString();
  server.exchangeCount = server.exchangeCount + 1;
  await saveRegistry(storage, registry);
  emitRegistryUpdate();
}

// Helper: Handle session transition for initialize
async function handleSessionTransition(
  storage: string,
  server: McpServer,
  targetResponse: Response,
  sessionId: string,
  jsonRpcRequest: JsonRpcRequest,
  requestCaptureFilename: string,
): Promise<void> {
  if (jsonRpcRequest.method !== "initialize" || sessionId !== "stateless") {
    return;
  }

  const responseSessionId =
    targetResponse.headers.get("Mcp-Session-Id") ||
    targetResponse.headers.get("mcp-session-id");

  if (responseSessionId) {
    // Copy client info to new session
    const clientInfo = getClientInfo(sessionId);
    if (clientInfo) {
      storeClientInfo(responseSessionId, clientInfo);
    }

    // Rename capture file to use new session ID
    const newFilename = generateCaptureFilename(server.name, responseSessionId);
    const oldPath = join(storage, server.name, requestCaptureFilename);
    const newPath = join(storage, server.name, newFilename);

    try {
      await rename(oldPath, newPath);
    } catch (error) {
      console.warn(`Failed to rename capture file: ${error}`);
    }
  }
}

// Helper: Log request
function logRequest(
  server: McpServer,
  sessionId: string,
  request: JsonRpcRequest,
): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    sessionId,
    method: request.method,
    httpStatus: 0,
    duration: 0,
    direction: "request",
    request,
  };

  emitLog(logEntry);
}

// Helper: Log response
function logResponse(
  server: McpServer,
  sessionId: string,
  method: string,
  httpStatus: number,
  duration: number,
  response?: JsonRpcResponse,
): void {
  const errorMessage =
    response &&
    typeof response === "object" &&
    "error" in response &&
    response.error
      ? `JSON-RPC ${response.error.code}: ${response.error.message}`
      : undefined;

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    sessionId,
    method,
    httpStatus,
    duration,
    direction: "response",
    errorMessage,
    response,
  };

  // Emit log to TUI
  emitLog(logEntry);
}

// Create main application
export async function createApp(
  registry: Registry,
  storageDir?: string,
): Promise<{ app: Hono; registry: Registry }> {
  const app = new Hono();

  // Determine storage directory
  const storage = getStorageRoot(storageDir);

  // Health check endpoint
  app.get("/", (c) => {
    return c.json({
      name: "mcp-gateway",
      version: "0.1.1",
      servers: registry.servers.length,
      uptime: process.uptime(),
    });
  });

  // Registry status endpoint
  app.get("/status", (c) => {
    return c.json({
      registry: {
        servers: registry.servers.map((s) => ({
          name: s.name,
          url: s.url,
          type: s.type,
          lastActivity: s.lastActivity,
          exchangeCount: s.exchangeCount,
        })),
      },
      storage: storage,
    });
  });

  // Single dynamic proxy route with proper validation
  app.post(
    "/:server/mcp",
    sValidator("param", serverParamSchema),
    sValidator("json", jsonRpcRequestSchema),
    sValidator("header", sessionHeaderSchema),
    async (c) => {
      const startTime = Date.now();

      // Get validated data
      const { server: serverName } = c.req.valid("param");
      const jsonRpcRequest = c.req.valid("json");

      // Find server in registry

      const server = getServer(registry, serverName);
      if (!server) {
        return c.notFound();
      }

      // Extract session ID from headers
      const validatedHeaders = c.req.valid("header");
      const sessionId = extractSessionId(validatedHeaders);

      // Capture request immediately (before forwarding)
      const requestRecord = createRequestCaptureRecord(
        server.name,
        sessionId,
        jsonRpcRequest,
      );
      const requestCaptureFilename = await appendCapture(
        storage,
        requestRecord,
      );

      // Log incoming request from client
      logRequest(server, sessionId, jsonRpcRequest);

      let response: JsonRpcResponse;
      let httpStatus = 200;

      try {
        // Handle initialize method - store client info
        handleInitializeClientInfo(sessionId, jsonRpcRequest);

        // Forward request to target MCP server using Hono proxy helper
        const proxyHeaders = buildProxyHeaders(c, server);

        const targetResponse = await proxy(server.url, {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify(jsonRpcRequest),
        });

        httpStatus = targetResponse.status;

        // Check if response is SSE stream
        const contentType =
          targetResponse.headers.get("content-type")?.toLowerCase() || "";
        const isSSE = contentType.startsWith("text/event-stream");

        if (isSSE) {
          // Handle SSE streaming response

          // Update server activity immediately for SSE
          await updateServerActivity(storage, registry, server);

          if (!targetResponse.body) {
            throw new Error("SSE response has no body");
          }

          // Create two streams from the response body
          const [streamForClient, streamForCapture] = targetResponse.body.tee();

          // Start background capture processing
          processSSECapture(
            streamForCapture,
            storage,
            server,
            sessionId,
            jsonRpcRequest.method,
            jsonRpcRequest.id,
          );

          // Return streaming response to client
          return new Response(streamForClient, {
            status: httpStatus,
            headers: targetResponse.headers,
          });
        }

        // Handle regular JSON response (existing logic)
        // Read body as text first to avoid consuming the stream twice
        const responseText = await targetResponse.text();
        let responseBody: unknown;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          // If not valid JSON, use as-is
          responseBody = responseText;
        }
        response = responseBody as JsonRpcResponse;
        const duration = Date.now() - startTime;

        // Capture response (only if request expected one - has id)
        if (jsonRpcRequest.id != null) {
          const responseRecord = createResponseCaptureRecord(
            server.name,
            sessionId,
            response,
            httpStatus,
            jsonRpcRequest.method,
          );
          await appendCapture(storage, responseRecord);
        }

        // Handle initialize → session transition
        await handleSessionTransition(
          storage,
          server,
          targetResponse,
          sessionId,
          jsonRpcRequest,
          requestCaptureFilename,
        );

        // Log response
        logResponse(
          server,
          sessionId,
          jsonRpcRequest.method,
          httpStatus,
          duration,
          response,
        );

        // Update server activity
        await updateServerActivity(storage, registry, server);

        // Create new response with the same data and headers
        const responseHeaders = new Headers(targetResponse.headers);
        return new Response(responseText, {
          status: httpStatus,
          headers: responseHeaders,
        });
      } catch (error) {
        const duration = Date.now() - startTime;

        // Create error response
        const errorResponse: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: jsonRpcRequest.id ?? null,
          error: {
            code: -32603,
            message: String(error),
          },
        };

        // Log error response
        logResponse(
          server,
          sessionId,
          jsonRpcRequest.method,
          httpStatus,
          duration,
          errorResponse,
        );

        // Capture error
        await captureError(
          storage,
          server.name,
          sessionId,
          jsonRpcRequest,
          {
            code: -32603,
            message: String(error),
          },
          httpStatus,
          duration,
        );

        return new Response(JSON.stringify(errorResponse), {
          status: httpStatus,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  );

  // Mount MCP server for gateway management tools
  app.route("/", createMcpApp(registry, storage));
  return { app, registry };
}

// Background processing of SSE stream for capture
async function processSSECapture(
  stream: ReadableStream<Uint8Array>,
  storageDir: string,
  server: McpServer,
  sessionId: string,
  method: string,
  requestId?: string | number | null,
): Promise<void> {
  try {
    const reader = stream.getReader();
    const eventStream = createSSEEventStream(reader);
    const eventReader = eventStream.getReader();

    let _eventCount = 0;

    while (true) {
      const { done, value: sseEvent } = await eventReader.read();

      if (done) {
        break;
      }

      _eventCount++;

      // Try to parse SSE data as JSON-RPC
      if (sseEvent.data) {
        const jsonRpcMessage = parseJsonRpcFromSSE(sseEvent.data);

        if (jsonRpcMessage) {
          // Capture as JSON-RPC message
          const isResponse = isJsonRpcResponse(jsonRpcMessage);
          const record = await captureSSEJsonRpc(
            storageDir,
            server.name,
            sessionId,
            jsonRpcMessage,
            sseEvent,
            isResponse,
          );

          // Log response to TUI if it's a response
          if (record && isResponse && record.response) {
            logResponse(
              server,
              sessionId,
              record.method,
              record.metadata.httpStatus,
              record.metadata.durationMs,
              record.response,
            );
          }
        } else {
          // Capture as raw SSE event
          await captureSSEEvent(
            storageDir,
            server.name,
            sessionId,
            sseEvent,
            method,
            requestId,
          );
        }
      } else {
        // Capture events without data
        await captureSSEEvent(
          storageDir,
          server.name,
          sessionId,
          sseEvent,
          method,
          requestId,
        );
      }
    }
  } catch (error) {
    console.error(`${server.name} → ${method} (SSE capture error):`, error);
    // Don't throw - capture failures shouldn't affect the client stream
  }
}

// Create app instance for development
const devRegistry = await loadRegistry(getStorageRoot());
const { app } = await createApp(devRegistry, getStorageRoot());
const port = 3333;

export default {
  port,
  fetch: app.fetch,
};

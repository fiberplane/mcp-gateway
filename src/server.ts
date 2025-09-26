import { rename } from "node:fs/promises";
import { join } from "node:path";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import {
  appendCapture,
  captureError,
  captureSSEEvent,
  captureSSEJsonRpc,
  createRequestCaptureRecord,
  createResponseCaptureRecord,
  storeClientInfo,
} from "./capture.js";
import {
  createSSEEventStream,
  isJsonRpcNotification,
  isJsonRpcResponse,
  parseJsonRpcFromSSE,
} from "./sse-parser.js";
import { getServer, type Registry } from "./registry.js";
import {
  clientInfoSchema,
  generateCaptureFilename,
  type JsonRpcResponse,
  jsonRpcRequestSchema,
  serverParamSchema,
  sessionHeaderSchema,
} from "./schemas.js";
import { getStorageRoot, loadRegistry, saveRegistry } from "./storage.js";
import { serveEmojiFavicon } from "./ui/serve-emoji-favicon.js";
import { createUIHandler } from "./ui/ui.js";
import { createMcpApp } from "./mcp-server.js";

// Create main application
export async function createApp(
  registry: Registry,
  storageDir?: string,
): Promise<{ app: Hono; registry: Registry }> {
  const app = new Hono();

  // Determine storage directory
  const storage = getStorageRoot(storageDir);

  app.use(serveEmojiFavicon("🌉"));

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

  app.route("/ui", createUIHandler(registry, storage));

  // Mount MCP server for gateway management tools
  app.route("/", createMcpApp(registry, storage));

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

      // Get validated headers and extract session ID using Zod validation
      const validatedHeaders = c.req.valid("header");
      const sessionId =
        validatedHeaders["Mcp-Session-Id"] ||
        validatedHeaders["mcp-session-id"] ||
        "stateless";

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

      let response: JsonRpcResponse;
      let httpStatus = 200;

      try {
        // Handle initialize method - store client info
        if (jsonRpcRequest.method === "initialize" && jsonRpcRequest.params) {
          const params = jsonRpcRequest.params as Record<string, unknown>;
          if (params.clientInfo) {
            const clientResult = clientInfoSchema.safeParse(params.clientInfo);
            if (clientResult.success) {
              storeClientInfo(sessionId, clientResult.data);
            }
          }
        }

        // Forward request to target MCP server using Hono proxy helper
        const proxyHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "MCP-Protocol-Version":
            c.req.raw.headers.get("MCP-Protocol-Version") || "2025-06-18",
          "Mcp-Session-Id": c.req.raw.headers.get("Mcp-Session-Id") || "",
          "mcp-session-id": c.req.raw.headers.get("mcp-session-id") || "",
          ...server.headers,
        };

        // Forward Accept header to enable SSE negotiation
        const acceptHeader = c.req.raw.headers.get("Accept");
        if (acceptHeader) {
          proxyHeaders.Accept = acceptHeader;
        }

        const targetResponse = await proxy(server.url, {
          method: "POST",
          headers: proxyHeaders,
          body: JSON.stringify(jsonRpcRequest),
        });

        httpStatus = targetResponse.status;

        // Check if response is SSE stream
        const contentType = targetResponse.headers.get("content-type")?.toLowerCase() || "";
        const isSSE = contentType.startsWith("text/event-stream");

        if (isSSE) {
          // Handle SSE streaming response
          console.log(`${server.name} → ${jsonRpcRequest.method} (SSE stream started)`);

          // Update server activity immediately for SSE
          server.lastActivity = new Date().toISOString();
          server.exchangeCount = server.exchangeCount + 1;
          await saveRegistry(storage, registry);

          if (!targetResponse.body) {
            throw new Error("SSE response has no body");
          }

          // Create two streams from the response body
          const [streamForClient, streamForCapture] = targetResponse.body.tee();

          // Start background capture processing
          processSSECapture(
            streamForCapture,
            storage,
            server.name,
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
        let responseBody: unknown;
        try {
          responseBody = await targetResponse.json();
        } catch {
          // If not JSON, try to get as text
          responseBody = await targetResponse.text();
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

        // Handle initialize → session transition: check if response provides session ID
        if (
          jsonRpcRequest.method === "initialize" &&
          sessionId === "stateless"
        ) {
          const responseSessionId =
            targetResponse.headers.get("Mcp-Session-Id") ||
            targetResponse.headers.get("mcp-session-id");

          if (responseSessionId) {
            // Rename the stateless file to use the actual session ID
            const newFilename = generateCaptureFilename(
              server.name,
              responseSessionId,
            );

            const oldPath = join(storage, server.name, requestCaptureFilename);
            const newPath = join(storage, server.name, newFilename);

            try {
              await rename(oldPath, newPath);
              console.log(`New session created: ${responseSessionId}`);
            } catch (error) {
              console.warn(`Failed to rename capture file: ${error}`);
            }
          }
        }

        // Color code based on status
        const statusColor =
          httpStatus >= 200 && httpStatus < 300
            ? "\x1b[92m" // green for success
            : httpStatus >= 400 && httpStatus < 500
              ? "\x1b[93m" // yellow for client errors
              : "\x1b[91m"; // red for server errors
        const reset = "\x1b[0m";

        const statusText =
          httpStatus >= 200 && httpStatus < 300
            ? "OK"
            : httpStatus >= 400 && httpStatus < 500
              ? "Client Error"
              : "Server Error";

        console.log(
          `${server.name} → ${jsonRpcRequest.method} ${statusColor}(${httpStatus} ${statusText}, ${duration}ms)${reset}`,
        );

        // Update the server object in place
        server.lastActivity = new Date().toISOString();
        server.exchangeCount = server.exchangeCount + 1;

        await saveRegistry(storage, registry);

        // Create new response with the same data and headers
        const responseHeaders = new Headers(targetResponse.headers);
        if (typeof responseBody === "string") {
          return new Response(responseBody, {
            status: httpStatus,
            headers: responseHeaders,
          });
        } else {
          return new Response(JSON.stringify(responseBody), {
            status: httpStatus,
            headers: responseHeaders,
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;

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

        // Return JSON-RPC error response
        const errorResponse: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: jsonRpcRequest.id ?? null,
          error: {
            code: -32603,
            message: String(error),
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: httpStatus,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
  );

  return { app, registry };
}

// Background processing of SSE stream for capture
async function processSSECapture(
  stream: ReadableStream<Uint8Array>,
  storageDir: string,
  serverName: string,
  sessionId: string,
  method: string,
  requestId?: string | number | null,
): Promise<void> {
  try {
    const reader = stream.getReader();
    const eventStream = createSSEEventStream(reader);
    const eventReader = eventStream.getReader();

    let eventCount = 0;

    while (true) {
      const { done, value: sseEvent } = await eventReader.read();

      if (done) {
        console.log(`${serverName} → ${method} (SSE stream ended, ${eventCount} events captured)`);
        break;
      }

      eventCount++;

      // Try to parse SSE data as JSON-RPC
      if (sseEvent.data) {
        const jsonRpcMessage = parseJsonRpcFromSSE(sseEvent.data);

        if (jsonRpcMessage) {
          // Capture as JSON-RPC message
          const isResponse = isJsonRpcResponse(jsonRpcMessage);
          await captureSSEJsonRpc(
            storageDir,
            serverName,
            sessionId,
            jsonRpcMessage,
            sseEvent,
            isResponse,
          );

          const messageType = isResponse ? "response" :
            isJsonRpcNotification(jsonRpcMessage) ? "notification" : "request";
          const messageMethod = "method" in jsonRpcMessage ? jsonRpcMessage.method : "unknown";
          console.log(`${serverName} → ${method} (SSE ${messageType}: ${messageMethod})`);
        } else {
          // Capture as raw SSE event
          await captureSSEEvent(
            storageDir,
            serverName,
            sessionId,
            sseEvent,
            method,
            requestId,
          );

          console.log(`${serverName} → ${method} (SSE event: ${sseEvent.event || "message"})`);
        }
      } else {
        // Capture events without data
        await captureSSEEvent(
          storageDir,
          serverName,
          sessionId,
          sseEvent,
          method,
          requestId,
        );
      }
    }
  } catch (error) {
    console.error(`${serverName} → ${method} (SSE capture error):`, error);
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

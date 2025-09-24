import { rename } from "node:fs/promises";
import { join } from "node:path";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import {
  appendCapture,
  captureError,
  createCaptureRecord,
  storeClientInfo,
} from "./capture.js";
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

  app.route("/ui", createUIHandler(registry));

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
        const targetResponse = await proxy(server.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "MCP-Protocol-Version":
              c.req.raw.headers.get("MCP-Protocol-Version") || "2025-06-18",
            "Mcp-Session-Id": c.req.raw.headers.get("Mcp-Session-Id") || "",
            "mcp-session-id": c.req.raw.headers.get("mcp-session-id") || "",
            ...server.headers,
          },
          body: JSON.stringify(jsonRpcRequest),
        });

        httpStatus = targetResponse.status;

        // Get response body for capture and create new response
        let responseBody: unknown;
        try {
          responseBody = await targetResponse.json();
        } catch {
          // If not JSON, try to get as text
          responseBody = await targetResponse.text();
        }
        response = responseBody as JsonRpcResponse;
        const duration = Date.now() - startTime;

        // Capture exchange (success or error based on HTTP status)
        const record = createCaptureRecord(
          server.name,
          sessionId,
          jsonRpcRequest,
          response,
          duration,
          httpStatus,
        );

        const captureFilename = await appendCapture(storage, record);

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

            const oldPath = join(storage, server.name, captureFilename);
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

// Create app instance for development
const devRegistry = await loadRegistry(getStorageRoot());
const { app } = await createApp(devRegistry, getStorageRoot());
const port = 3333;

export default {
  port,
  fetch: app.fetch,
};

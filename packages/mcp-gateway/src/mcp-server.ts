import { Hono } from "hono";
import { cors } from "hono/cors";
import { McpServer, RpcError, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";
import { logger } from "./logger.js";
import { createCaptureTools } from "./mcp-tools/capture-tools.js";
import { createServerTools } from "./mcp-tools/server-tools.js";
import type { Registry } from "@fiberplane/mcp-gateway-types";

/**
 * Creates an MCP server instance for the gateway with tools for server management
 * and capture analysis. The server exposes tools that allow MCP clients to manage
 * the gateway's server registry and analyze captured MCP traffic.
 *
 * @param registry - The gateway's server registry
 * @param storageDir - Directory where captures are stored
 * @returns MCP server instance with configured tools
 */
export function createMcpServer(
  registry: Registry,
  storageDir: string,
): McpServer {
  // Create MCP server with Zod schema adapter for validation
  const mcp = new McpServer({
    name: "mcp-gateway-tools",
    version: "1.0.0",
    schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
  });

  // Add request logging middleware
  mcp.use(async (ctx, next) => {
    const startTime = Date.now();
    logger.debug("MCP request started", {
      method: ctx.request.method,
      requestId: ctx.requestId,
    });

    await next();

    const duration = Date.now() - startTime;
    logger.debug("MCP request completed", {
      method: ctx.request.method,
      duration,
    });
  });

  // Add error handling middleware
  mcp.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      logger.error("MCP request error", {
        method: ctx.request.method,
        error: String(error),
      });
      throw error;
    }
  });

  // Register server management tools
  createServerTools(mcp, registry, storageDir);

  // Register capture analysis tools (only search_records)
  createCaptureTools(mcp, registry, storageDir);

  // Set up custom error handler
  mcp.onError((error, ctx) => {
    logger.error("MCP error handler called", {
      method: ctx.request.method,
      error: String(error),
    });

    // Handle RpcError instances from mcp-lite (e.g., validation errors)
    if (error instanceof RpcError) {
      return {
        code: error.code,
        message: error.message,
        data: { requestId: ctx.requestId },
      };
    }

    if (error instanceof z.ZodError) {
      return {
        code: -32602, // Invalid params
        message: "Input validation failed",
        data: {
          issues: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
          requestId: ctx.requestId,
        },
      };
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return {
        code: -32601, // Method not found
        message: error.message,
        data: { requestId: ctx.requestId },
      };
    }

    return {
      code: -32603, // Internal error
      message: "Internal server error",
      data: { requestId: ctx.requestId },
    };
  });

  return mcp;
}

/**
 * Creates a Hono app that serves the MCP server over HTTP with SSE support.
 * The server is mounted at /mcp endpoint. This app is meant to be mounted at
 * /gateway (canonical) or /g (short alias) in the main server.
 *
 * @param registry - The gateway's server registry
 * @param storageDir - Directory where captures are stored
 * @returns Hono app configured to serve the MCP server
 */
export function createMcpApp(registry: Registry, storageDir: string): Hono {
  const mcp = createMcpServer(registry, storageDir);

  // Create HTTP transport for the MCP server
  const transport = new StreamableHttpTransport();
  const httpHandler = transport.bind(mcp);

  // Create Hono app for the MCP endpoint
  const app = new Hono();

  // Enable CORS for MCP client access
  app.use(
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "MCP-Protocol-Version", "Authorization"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  // Mount MCP server at /mcp endpoint
  app.all("/mcp", async (c) => {
    const response = await httpHandler(c.req.raw);
    return response;
  });

  return app;
}

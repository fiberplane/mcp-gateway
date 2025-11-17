import { logger } from "@fiberplane/mcp-gateway-core";
import { type Gateway, JSON_RPC_ERRORS } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { McpServer, RpcError, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";
import { createCaptureTools } from "./tools/capture-tools";
import { createServerTools } from "./tools/server-tools";

/**
 * Creates an MCP server instance for the gateway with tools for server management
 * and capture analysis. The server exposes tools that allow MCP clients to manage
 * the gateway's server registry and analyze captured MCP traffic.
 *
 * @param gateway - Gateway instance for accessing query operations and server management
 * @returns MCP server instance with configured tools
 */
export function createMcpServer(gateway: Gateway): McpServer {
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

  // Register server management tools with explicit dependencies
  createServerTools(mcp, {
    getRegisteredServers: () => gateway.storage.getRegisteredServers(),
    addServer: (server) => gateway.storage.addServer(server),
    removeServer: (name) => gateway.storage.removeServer(name),
  });

  // Register capture analysis tools with explicit dependencies
  createCaptureTools(mcp, {
    query: (options) => gateway.storage.query(options),
  });

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
        code: JSON_RPC_ERRORS.INVALID_PARAMS,
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
        code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        message: error.message,
        data: { requestId: ctx.requestId },
      };
    }

    return {
      code: JSON_RPC_ERRORS.INTERNAL_ERROR,
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
 * @param gateway - Gateway instance for accessing query operations
 * @returns Hono app configured to serve the MCP server
 */
export function createMcpApp(gateway: Gateway): Hono {
  const mcp = createMcpServer(gateway);

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

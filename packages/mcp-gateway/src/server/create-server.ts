import { Hono } from "hono";
import { logger as loggerMiddleware } from "hono/logger";
import { logger } from "../logger.js";
import { createMcpApp } from "../mcp-server.js";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import { getStorageRoot } from "../storage.js";
import { createOAuthRoutes } from "./create-oauth-routes.js";
import { createProxyRoutes } from "./create-proxy-routes.js";

// Create main application
export async function createApp(
  registry: Registry,
  storageDir?: string,
): Promise<{ app: Hono; registry: Registry }> {
  const app = new Hono();

  // Custom Hono logger middleware to log to our log files
  app.use(
    loggerMiddleware((message: string, ...rest: string[]) => {
      if (rest.length > 0) {
        logger.debug(message, { honoLoggerArgs: rest });
      } else {
        logger.debug(message);
      }
    }),
  );

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

  // Mount OAuth discovery and registration routes
  // These need to be mounted BEFORE the proxy routes to handle .well-known paths
  const oauthRoutes = await createOAuthRoutes(registry);
  app.route("/", oauthRoutes);

  // Mount the proxy routes for server connections
  const proxyRoutes = await createProxyRoutes(registry, storage);
  app.route("/servers", proxyRoutes);
  // Short alias for server connections
  app.route("/s", proxyRoutes);

  // Mount the gateway's own MCP server at canonical path
  const gatewayMcp = createMcpApp(registry, storage);
  app.route("/gateway", gatewayMcp);
  // Short alias for gateway's own MCP server
  app.route("/g", gatewayMcp);

  return { app, registry };
}

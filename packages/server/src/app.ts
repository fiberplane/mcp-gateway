import {
  createMcpApp,
  getStorageRoot,
  logger,
  queryLogs,
  getServers,
  getSessions,
} from "@fiberplane/mcp-gateway-core";
import type { LogEntry, Registry } from "@fiberplane/mcp-gateway-types";
import { createApp as createApiApp } from "@fiberplane/mcp-gateway-api";
import { Hono } from "hono";
import { logger as loggerMiddleware } from "hono/logger";
import { createOAuthRoutes } from "./routes/oauth";
import { createProxyRoutes } from "./routes/proxy";

// Create main application
export async function createApp(
  registry: Registry,
  storageDir?: string,
  eventHandlers?: {
    onLog?: (entry: LogEntry) => void;
    onRegistryUpdate?: () => void;
  },
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

  // Mount API routes for querying logs
  const apiApp = createApiApp(storage, {
    queryLogs,
    getServers,
    getSessions,
  });
  app.route("/api", apiApp);

  // Mount OAuth discovery and registration routes
  // These need to be mounted BEFORE the proxy routes to handle .well-known paths
  const oauthRoutes = await createOAuthRoutes(registry);
  app.route("/", oauthRoutes);

  // Mount the proxy routes for server connections
  const proxyRoutes = await createProxyRoutes(registry, storage, eventHandlers);
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

import type { Gateway } from "@fiberplane/mcp-gateway-core";
import type {
  LogEntry,
  Logger,
  ProxyDependencies,
} from "@fiberplane/mcp-gateway-types";
import type { Hono } from "hono";
import { Hono as HonoApp } from "hono";
import { logger as loggerMiddleware } from "hono/logger";
import { createOAuthRoutes } from "./routes/oauth";
import { createProxyRoutes } from "./routes/proxy";

/**
 * Create MCP Gateway HTTP server
 *
 * This creates a Hono app focused on MCP protocol handling:
 * - Proxy routes for forwarding MCP requests to upstream servers
 * - OAuth routes for MCP authentication/authorization
 * - Gateway's own MCP server for querying the gateway via MCP protocol
 * - Health check endpoint
 *
 * Note: This does NOT include the query API or Web UI - those should be
 * mounted separately by the CLI package for observability/management.
 */
export async function createApp(options: {
  storageDir: string;
  createMcpApp: (gateway: Gateway) => Hono;
  logger: Logger;
  proxyDependencies: ProxyDependencies;
  gateway: Gateway;
  onLog?: (entry: LogEntry) => void;
  onRegistryUpdate?: () => void;
}): Promise<{ app: Hono }> {
  const {
    storageDir,
    createMcpApp,
    logger,
    proxyDependencies,
    gateway,
    onLog,
    onRegistryUpdate,
  } = options;
  const app = new HonoApp();

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

  // Health check endpoint
  app.get("/", async (c) => {
    const servers = await gateway.storage.getRegisteredServers();
    return c.json({
      name: "mcp-gateway",
      version: "0.1.1",
      servers: servers.length,
      uptime: process.uptime(),
    });
  });

  // Registry status endpoint
  app.get("/status", async (c) => {
    const servers = await gateway.storage.getRegisteredServers();
    return c.json({
      registry: {
        servers: servers.map((s) => ({
          name: s.name,
          url: s.url,
          type: s.type,
          lastActivity: s.lastActivity,
          exchangeCount: s.exchangeCount,
        })),
      },
      storage: storageDir,
    });
  });

  // Mount OAuth discovery and registration routes
  // These need to be mounted BEFORE the proxy routes to handle .well-known paths
  const oauthRoutes = await createOAuthRoutes((name) =>
    gateway.storage.getServer(name),
  );
  app.route("/", oauthRoutes);

  // Mount the proxy routes for server connections
  const proxyRoutes = await createProxyRoutes({
    dependencies: proxyDependencies,
    onLog,
    onRegistryUpdate,
  });
  app.route("/servers", proxyRoutes);
  // Short alias for server connections
  app.route("/s", proxyRoutes);

  // Mount the gateway's own MCP server at canonical path
  const gatewayMcp = createMcpApp(gateway);
  app.route("/gateway", gatewayMcp);
  // Short alias for gateway's own MCP server
  app.route("/g", gatewayMcp);

  return { app };
}

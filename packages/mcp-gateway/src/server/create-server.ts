import { Hono } from "hono";
import { logger } from "hono/logger";
import { createMcpApp } from "../mcp-server.js";
import type { Registry } from "../registry.js";
import { getStorageRoot, loadRegistry } from "../storage.js";
import { createProxyRoutes } from "./create-proxy-routes.js";

// Create main application
export async function createApp(
  registry: Registry,
  storageDir?: string,
): Promise<{ app: Hono; registry: Registry }> {
  const app = new Hono();

  // TODO - Remove me, I added this for debugging
  app.use(logger());

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

// Create app instance for development
const devRegistry = await loadRegistry(getStorageRoot());
const { app } = await createApp(devRegistry, getStorageRoot());
const port = 3333;

export default {
  port,
  fetch: app.fetch,
};

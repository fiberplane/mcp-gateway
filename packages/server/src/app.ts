import {
  createMcpApp,
  getStorageRoot,
  logger,
  ClientManager,
  saveCanonicalTools,
  saveRegistry,
} from "@fiberplane/mcp-gateway-core";
import type { LogEntry, Registry } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import { logger as loggerMiddleware } from "hono/logger";
import { createOAuthRoutes } from "./routes/oauth";
import { createOAuthCallbackRoutes } from "./routes/oauth-callback";
import { createProxyRoutes } from "./routes/proxy";

// Create main application
export async function createApp(
  registry: Registry,
  storageDir?: string,
  eventHandlers?: {
    onLog?: (entry: LogEntry) => void;
    onRegistryUpdate?: () => void;
    enableMcpClient?: boolean;
    port?: number;
  },
): Promise<{ app: Hono; registry: Registry; clientManager?: ClientManager }> {
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

  // Initialize ClientManager if enabled
  let clientManager: ClientManager | undefined;
  const port = eventHandlers?.port || 3333;

  if (eventHandlers?.enableMcpClient) {
    logger.info("Initializing MCP client manager");
    clientManager = new ClientManager(
      registry,
      storage,
      port,
      eventHandlers?.onRegistryUpdate,
    );

    // Connect to all registered servers
    for (const server of registry.servers) {
      try {
        await clientManager.connectServer(server);
        const tools = await clientManager.discoverTools(server.name);
        await saveCanonicalTools(storage, server.name, tools);
        logger.info(`Connected to ${server.name} via MCP client`, {
          toolCount: tools.length,
        });
      } catch (error) {
        logger.error(`Failed to connect to ${server.name}`, {
          error: String(error),
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorMessage:
            error && typeof error === "object" && "message" in error
              ? error.message
              : undefined,
        });
      }
    }
  }

  // Mount OAuth callback routes after ClientManager is initialized
  if (clientManager) {
    const oauthCallbackRoutes = createOAuthCallbackRoutes(
      registry,
      clientManager,
      storage,
      {
        onRegistryUpdate: eventHandlers?.onRegistryUpdate,
        onAuthComplete: async (serverName, token) => {
          // Reconnect to server after successful auth
          logger.info(`Reconnecting to ${serverName} after OAuth`);
          const server = registry.servers.find((s) => s.name === serverName);
          if (server) {
            try {
              // Disconnect existing connection (which doesn't have the token)
              await clientManager.disconnectServer(serverName);

              // Connect with the updated server object (which now has the token)
              await clientManager.connectServer(server);
              const tools = await clientManager.discoverTools(serverName);
              await saveCanonicalTools(storage, serverName, tools);
              logger.info(`Reconnected to ${serverName} successfully`, {
                toolCount: tools.length,
              });
            } catch (error) {
              logger.error(`Failed to reconnect to ${serverName}`, {
                error: String(error),
              });
            }
          }
        },
      },
    );
    app.route("/oauth", oauthCallbackRoutes);
  }

  // Mount the proxy routes for server connections
  const proxyRoutes = await createProxyRoutes(registry, storage, {
    ...eventHandlers,
    clientManager,
  });
  app.route("/servers", proxyRoutes);
  // Short alias for server connections
  app.route("/s", proxyRoutes);

  // Mount the gateway's own MCP server at canonical path
  const gatewayMcp = createMcpApp(registry, storage);
  app.route("/gateway", gatewayMcp);
  // Short alias for gateway's own MCP server
  app.route("/g", gatewayMcp);

  return { app, registry, clientManager };
}

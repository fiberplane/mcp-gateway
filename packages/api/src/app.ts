import type {
  ApiError,
  Logger,
  QueryFunctions,
} from "@fiberplane/mcp-gateway-types";
import type { Hono } from "hono";
import { createApiRoutes } from "./routes/index.js";
import type { ServerManagementFunctions } from "./routes/server-management.js";

/**
 * Configuration options for creating an API application
 */
export interface CreateAppOptions {
  /**
   * Query functions for data access (required)
   */
  queries: QueryFunctions;

  /**
   * Logger instance for error logging (required)
   */
  logger: Logger;

  /**
   * Server management functions (optional)
   *
   * When provided, enables CRUD routes for server configurations:
   * - GET /servers/config - List all server configurations
   * - POST /servers/config - Add a new server
   * - PUT /servers/config/:name - Update a server
   * - DELETE /servers/config/:name - Delete a server
   */
  serverManagement?: ServerManagementFunctions;
}

/**
 * Create a standalone API server for querying MCP Gateway logs and managing servers
 *
 * This creates a Hono app that can be mounted at any path or run standalone.
 * The API exposes endpoints for:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 * - GET /clients - List clients with aggregated stats
 * - POST /logs/clear - Clear all session data
 * - GET /servers/config - List all server configurations (if serverManagement provided)
 * - POST /servers/config - Add a new server (if serverManagement provided)
 * - PUT /servers/config/:name - Update a server (if serverManagement provided)
 * - DELETE /servers/config/:name - Delete a server (if serverManagement provided)
 *
 * @param options - Configuration options
 * @returns Hono app with mounted API routes
 *
 * @example Basic usage
 * ```typescript
 * const app = createApp({
 *   queries: {
 *     queryLogs: (options) => storage.query(options),
 *     getServers: () => storage.getServers(),
 *     getSessions: (serverName) => storage.getSessions(serverName),
 *     getClients: () => storage.getClients(),
 *     clearSessions: () => storage.clearAll(),
 *   },
 *   logger: myLogger,
 * });
 * ```
 *
 * @example With server management
 * ```typescript
 * const app = createApp({
 *   queries: { ... },
 *   logger: myLogger,
 *   serverManagement: {
 *     getRegisteredServers: () => storage.getRegisteredServers(),
 *     addServer: (config) => storage.addServer(config),
 *     updateServer: (name, changes) => storage.updateServer(name, changes),
 *     removeServer: (name) => storage.removeServer(name),
 *   },
 * });
 * ```
 */
export function createApp(options: CreateAppOptions): Hono {
  const { queries, logger, serverManagement } = options;

  const app = createApiRoutes(queries, serverManagement);

  // Add global error handler for consistent error responses
  app.onError((err, c) => {
    logger.error("API error", {
      error: String(err),
      path: c.req.path,
      method: c.req.method,
    });

    return c.json<ApiError>(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: err.message || "An error occurred",
        },
      },
      500,
    );
  });

  return app;
}

import type { ApiError } from "@fiberplane/mcp-gateway-types";
import type { Hono } from "hono";
import { createApiRoutes, type QueryFunctions } from "./routes/index.js";

/**
 * Create a standalone API server for querying MCP Gateway logs
 *
 * This creates a Hono app that can be mounted at any path or run standalone.
 * The API exposes three endpoints:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 *
 * @param storageDir - Path to the MCP Gateway storage directory
 * @param queries - Query functions for data access (injected dependency)
 * @returns Hono app with API routes
 *
 * @example
 * ```typescript
 * import { createApp } from "@fiberplane/mcp-gateway-api";
 * import { queryLogs, getServers, getSessions } from "@fiberplane/mcp-gateway-core";
 *
 * const apiApp = createApp("~/.mcp-gateway", {
 *   queryLogs,
 *   getServers,
 *   getSessions,
 * });
 *
 * // Mount in another Hono app
 * mainApp.route("/api", apiApp);
 *
 * // Or run standalone
 * Bun.serve({ fetch: apiApp.fetch, port: 3000 });
 * ```
 */
export function createApp(storageDir: string, queries: QueryFunctions): Hono {
  const app = createApiRoutes(storageDir, queries);

  // Add global error handler for consistent error responses
  app.onError((err, c) => {
    console.error("API error", {
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

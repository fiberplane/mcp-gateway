import type { ApiError } from "@fiberplane/mcp-gateway-types";
import type { Hono } from "hono";
import { createApiRoutes, type QueryFunctions } from "./routes/index.js";

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Create a standalone API server for querying MCP Gateway logs
 *
 * This creates a Hono app that can be mounted at any path or run standalone.
 * The API exposes three endpoints:
 * - GET /logs - Query logs with filters and pagination
 * - GET /servers - List servers with aggregated stats
 * - GET /sessions - List sessions with aggregated stats
 *
 * @param storageDir - Path to the MCP Gateway storage directory (passed to query functions)
 * @param queries - Query functions for data access (dependency injected)
 * @param logger - Logger instance for error logging (dependency injected)
 * @returns Hono app with mounted API routes
 *
 * @example
 * See the CLI package (packages/cli/src/cli.ts) for a complete integration example
 * that shows how to wire the Gateway instance into the API's query functions.
 */
export function createApp(
  storageDir: string,
  queries: QueryFunctions,
  logger: Logger,
): Hono {
  const app = createApiRoutes(storageDir, queries);

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

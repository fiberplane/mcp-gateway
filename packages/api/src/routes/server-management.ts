import {
  getErrorMessage,
  isValidUrl,
  normalizeUrl,
  ServerAlreadyExistsError,
  ServerNotFoundError,
} from "@fiberplane/mcp-gateway-core";
import {
  type McpServer,
  type McpServerConfig,
  RestartNotSupportedError,
} from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

/**
 * Dependency injection interface for server management operations
 *
 * Decouples the API layer from the storage implementation,
 * allowing the core Gateway storage operations to be injected at runtime.
 *
 * ⚠️ SECURITY NOTICE:
 * These operations have NO authentication/authorization. Only expose on localhost
 * or behind a secure gateway in production. Do NOT expose directly to the internet.
 *
 * For production deployments, implement authentication middleware:
 * - API keys (for service-to-service)
 * - OAuth/JWT tokens (for user access)
 * - IP allowlisting (for network-level security)
 */
export interface ServerManagementFunctions {
  /**
   * Get all registered servers with configurations
   */
  getRegisteredServers: () => Promise<McpServer[]>;

  /**
   * Add a new server to the registry
   */
  addServer: (server: McpServerConfig) => Promise<void>;

  /**
   * Update an existing server configuration
   */
  updateServer: (
    name: string,
    changes: Partial<Omit<McpServerConfig, "name">>,
  ) => Promise<void>;

  /**
   * Remove a server from the registry
   */
  removeServer: (name: string) => Promise<void>;

  /**
   * Manually trigger health check for a server
   *
   * @throws {ServerNotFoundError} When server doesn't exist
   */
  checkServerHealth: (name: string) => Promise<McpServer>;

  /**
   * Restart a stdio server (for recovery after crash)
   *
   * @throws {ServerNotFoundError} When server doesn't exist
   * @throws {Error} When server is not stdio type
   */
  restartStdioServer: (name: string) => Promise<void>;
}

/**
 * Validation schema for server configuration (HTTP or stdio)
 * Wraps the base schema with name normalization and HTTP-specific validation
 */
const serverConfigSchema = z.union([
  // HTTP server with URL normalization
  z.object({
    name: z.string().min(1, "Server name is required").toLowerCase().trim(),
    type: z.literal("http"),
    url: z
      .string()
      .url("Invalid URL format")
      .transform((val): string => normalizeUrl(val))
      .refine((url) => isValidUrl(url), {
        message: "URL must use HTTP or HTTPS protocol",
      }),
    headers: z.record(z.string(), z.string()).optional().default({}),
  }),
  // Stdio server with name normalization
  z.object({
    name: z.string().min(1, "Server name is required").toLowerCase().trim(),
    type: z.literal("stdio"),
    command: z.string().min(1, "Command is required"),
    args: z.array(z.string()),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    timeout: z.number().positive().optional(),
    sessionMode: z
      .enum(["shared", "isolated"])
      .optional()
      .describe(
        'Session isolation mode. "shared" (default): single subprocess for all sessions. "isolated": one subprocess per session.',
      ),
  }),
]);

/**
 * Validation schema for server updates
 * Name and type cannot be changed
 * HTTP servers: url, headers
 * Stdio servers: command, args, env, cwd, timeout, sessionMode
 *
 * Uses passthrough to allow all stdio fields in a single schema
 */
const serverUpdateSchema = z
  .object({
    // HTTP fields
    url: z
      .string()
      .url("Invalid URL format")
      .transform((val): string => normalizeUrl(val))
      .refine((url) => isValidUrl(url), {
        message: "URL must use HTTP or HTTPS protocol",
      })
      .optional(),
    headers: z.record(z.string(), z.string()).optional(),
    // Stdio fields
    command: z.string().min(1).optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    timeout: z.number().positive().optional(),
    sessionMode: z.enum(["shared", "isolated"]).optional(),
  })
  .passthrough();

/**
 * Validation schema for server name parameter
 * Normalizes to lowercase to match stored server names
 */
const serverNameParamSchema = z.object({
  name: z.string().min(1, "Server name is required").toLowerCase().trim(),
});

/**
 * Create API routes for server management
 *
 * Routes:
 * - GET /servers/config - List all server configurations
 * - POST /servers/config - Add a new server
 * - PUT /servers/config/:name - Update an existing server
 * - DELETE /servers/config/:name - Delete a server
 *
 * @param functions - Server management functions to use for data access
 * @returns Hono app with server management routes
 */
export function createServerManagementRoutes(
  functions: ServerManagementFunctions,
): Hono {
  const app = new Hono();

  /**
   * GET /servers/config
   *
   * Get all server configurations with full details (not just aggregations)
   *
   * ⚠️ SENSITIVE DATA: Returns complete server configurations including custom headers.
   * Headers may contain sensitive data (API keys, tokens, etc.). Ensure this endpoint
   * is only accessible to authorized administrators.
   */
  app.get("/servers/config", async (c) => {
    try {
      const servers = await functions.getRegisteredServers();

      return c.json({ servers });
    } catch (error) {
      return c.json(
        {
          error: "Failed to fetch server configurations",
          message: getErrorMessage(error),
        },
        500,
      );
    }
  });

  /**
   * POST /servers/config
   *
   * Add a new server to the registry
   *
   * ⚠️ CONCURRENCY: Not safe for concurrent modifications. The underlying storage
   * uses a read-modify-write pattern. Ensure only one modification is in-flight
   * at a time (the Web UI handles this automatically).
   */
  app.post(
    "/servers/config",
    sValidator("json", serverConfigSchema),
    async (c) => {
      const serverConfig = c.req.valid("json") as z.infer<
        typeof serverConfigSchema
      >;

      try {
        await functions.addServer(serverConfig);

        return c.json(
          {
            success: true,
            server: serverConfig,
          },
          201,
        );
      } catch (error) {
        // Check if it's a duplicate name error
        if (error instanceof ServerAlreadyExistsError) {
          return c.json(
            {
              error: "Server already exists",
              message: error.message,
            },
            409, // Conflict
          );
        }

        return c.json(
          {
            error: "Failed to add server",
            message: getErrorMessage(error),
          },
          500,
        );
      }
    },
  );

  /**
   * PUT /servers/config/:name
   *
   * Update an existing server configuration
   *
   * ⚠️ CONCURRENCY: Not safe for concurrent modifications. Ensure only one
   * modification is in-flight at a time.
   */
  app.put(
    "/servers/config/:name",
    sValidator("param", serverNameParamSchema),
    sValidator("json", serverUpdateSchema),
    async (c) => {
      const { name } = c.req.valid("param") as z.infer<
        typeof serverNameParamSchema
      >;
      const changes = c.req.valid("json") as z.infer<typeof serverUpdateSchema>;

      // Validate that at least one field is provided
      const hasHttpChanges = "url" in changes || "headers" in changes;
      const hasStdioChanges =
        "command" in changes ||
        "args" in changes ||
        "env" in changes ||
        "cwd" in changes ||
        "timeout" in changes ||
        "sessionMode" in changes;

      if (!hasHttpChanges && !hasStdioChanges) {
        return c.json(
          {
            error: "No changes provided",
            message: "At least one field must be provided for update",
          },
          400,
        );
      }

      try {
        await functions.updateServer(
          name,
          changes as Partial<Omit<McpServerConfig, "name" | "type">>,
        );

        return c.json({
          success: true,
          message: `Server '${name}' updated successfully`,
        });
      } catch (error) {
        // Check if it's a not found error
        if (error instanceof ServerNotFoundError) {
          return c.json(
            {
              error: "Server not found",
              message: error.message,
            },
            404,
          );
        }

        return c.json(
          {
            error: "Failed to update server",
            message: getErrorMessage(error),
          },
          500,
        );
      }
    },
  );

  /**
   * DELETE /servers/config/:name
   *
   * Remove a server from the registry
   *
   * Note: Associated logs are preserved for historical analysis
   *
   * ⚠️ CONCURRENCY: Not safe for concurrent modifications. Ensure only one
   * modification is in-flight at a time.
   */
  app.delete(
    "/servers/config/:name",
    sValidator("param", serverNameParamSchema),
    async (c) => {
      const { name } = c.req.valid("param") as z.infer<
        typeof serverNameParamSchema
      >;

      try {
        await functions.removeServer(name);

        return c.json({
          success: true,
          message: `Server '${name}' removed successfully`,
        });
      } catch (error) {
        // Check if it's a not found error
        if (error instanceof ServerNotFoundError) {
          return c.json(
            {
              error: "Server not found",
              message: error.message,
            },
            404,
          );
        }

        return c.json(
          {
            error: "Failed to remove server",
            message: getErrorMessage(error),
          },
          500,
        );
      }
    },
  );

  /**
   * POST /servers/:name/health-check
   *
   * Manually trigger a health check for a specific server
   */
  app.post(
    "/servers/:name/health-check",
    sValidator("param", serverNameParamSchema),
    async (c) => {
      const { name } = c.req.valid("param");

      try {
        const server = await functions.checkServerHealth(name);
        return c.json({ server });
      } catch (error) {
        // Server not found - return 404
        if (error instanceof ServerNotFoundError) {
          return c.json(
            {
              error: "Server not found",
              message: `Server '${name}' does not exist`,
            },
            404,
          );
        }

        // Other errors (network failures, etc.) - return 500
        return c.json(
          {
            error: "Health check failed",
            message: getErrorMessage(error),
          },
          500,
        );
      }
    },
  );

  /**
   * POST /servers/:name/restart
   *
   * Manually restart a stdio server (for recovery after crash)
   *
   * Only works for stdio servers. HTTP servers don't have a restart operation.
   */
  app.post(
    "/servers/:name/restart",
    sValidator("param", serverNameParamSchema),
    async (c) => {
      const { name } = c.req.valid("param");

      try {
        await functions.restartStdioServer(name);
        return c.json({
          success: true,
          message: `Server '${name}' restarted successfully`,
        });
      } catch (error) {
        // Server not found - return 404
        if (error instanceof ServerNotFoundError) {
          return c.json(
            {
              error: "Server not found",
              message: `Server '${name}' does not exist`,
            },
            404,
          );
        }

        // RestartNotSupportedError (isolated mode) - return 400
        if (error instanceof RestartNotSupportedError) {
          return c.json(
            {
              error: error.message,
            },
            400,
          );
        }

        // Other errors (not stdio, restart failed, etc.) - return 400 or 500
        const errorMessage = getErrorMessage(error);
        const statusCode = errorMessage.includes("not a stdio server")
          ? 400
          : 500;

        return c.json(
          {
            error: "Restart failed",
            message: errorMessage,
          },
          statusCode,
        );
      }
    },
  );

  return app;
}

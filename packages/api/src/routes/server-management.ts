import {
  isValidUrl,
  normalizeUrl,
  ServerAlreadyExistsError,
  ServerNotFoundError,
} from "@fiberplane/mcp-gateway-core";
import type { McpServer, McpServerConfig } from "@fiberplane/mcp-gateway-types";
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
   */
  checkServerHealth: (name: string) => Promise<McpServer | undefined>;
}

/**
 * Validation schema for server configuration
 */
const serverConfigSchema = z.object({
  name: z.string().min(1, "Server name is required").toLowerCase().trim(),
  url: z
    .string()
    .url("Invalid URL format")
    .transform((val): string => normalizeUrl(val))
    .refine((url) => isValidUrl(url), {
      message: "URL must use HTTP or HTTPS protocol",
    }),
  type: z.literal("http"),
  headers: z.record(z.string(), z.string()).optional().default({}),
});

/**
 * Validation schema for server updates
 * Name cannot be changed, only url and headers
 */
const serverUpdateSchema = z.object({
  url: z
    .string()
    .url("Invalid URL format")
    .transform((val): string => normalizeUrl(val))
    .refine((url) => isValidUrl(url), {
      message: "URL must use HTTP or HTTPS protocol",
    })
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

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
          message: error instanceof Error ? error.message : String(error),
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
            message: error instanceof Error ? error.message : String(error),
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
      if (!changes.url && !changes.headers) {
        return c.json(
          {
            error: "No changes provided",
            message: "At least one of 'url' or 'headers' must be provided",
          },
          400,
        );
      }

      try {
        await functions.updateServer(name, changes);

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
            message: error instanceof Error ? error.message : String(error),
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
            message: error instanceof Error ? error.message : String(error),
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

        if (!server) {
          return c.json(
            {
              error: "Server not found",
              message: `Server '${name}' does not exist`,
            },
            404,
          );
        }

        return c.json({ server });
      } catch (error) {
        return c.json(
          {
            error: "Health check failed",
            message: error instanceof Error ? error.message : String(error),
          },
          500,
        );
      }
    },
  );

  return app;
}

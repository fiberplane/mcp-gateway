import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { getServer, type Registry } from "../registry.js";
import { serverParamSchema } from "../schemas.js";

/**
 * Creates Hono app for proxying OAuth 2.0 and OpenID Connect discovery endpoints.
 * These are lightweight proxies without full logging/capture - just forward requests.
 *
 * Handles:
 * - /.well-known/oauth-protected-resource
 * - /.well-known/oauth-authorization-server
 * - /.well-known/openid-configuration
 * - /register (OAuth Dynamic Client Registration)
 */
export async function createOAuthRoutes(registry: Registry): Promise<Hono> {
  const app = new Hono();

  // Helper to extract base URL from MCP server URL
  // E.g., "https://api.example.com/mcp" -> "https://api.example.com"
  function getBaseUrl(mcpUrl: string): string {
    try {
      const url = new URL(mcpUrl);
      // Remove the /mcp path if present
      const pathWithoutMcp = url.pathname.replace(/\/mcp\/?$/, "");
      return `${url.protocol}//${url.host}${pathWithoutMcp}`;
    } catch {
      // If URL parsing fails, return as-is
      return mcpUrl.replace(/\/mcp\/?$/, "");
    }
  }

  // Helper to build minimal proxy headers (just forward auth and standard headers)
  function buildMinimalProxyHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    // Forward Authorization header if present
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    // Forward Accept header if present
    const acceptHeader = request.headers.get("Accept");
    if (acceptHeader) {
      headers.Accept = acceptHeader;
    }

    // Forward Content-Type for POST requests
    const contentType = request.headers.get("Content-Type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    return headers;
  }

  // Pattern 1: /.well-known/oauth-protected-resource/{servers|s}/:server/mcp
  // Using Hono's named parameter regex to match both /servers/:server and /s/:server
  app.get(
    "/.well-known/oauth-protected-resource/:prefix{servers|s}/:server/mcp",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = getServer(registry, serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

      return proxy(targetUrl, {
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    },
  );

  // Pattern 2: /.well-known/oauth-authorization-server/{servers|s}/:server/mcp
  app.get(
    "/.well-known/oauth-authorization-server/:prefix{servers|s}/:server/mcp",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = getServer(registry, serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

      return proxy(targetUrl, {
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    },
  );

  // Pattern 3: /.well-known/openid-configuration/{servers|s}/:server/mcp
  app.get(
    "/.well-known/openid-configuration/:prefix{servers|s}/:server/mcp",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = getServer(registry, serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/openid-configuration`;

      return proxy(targetUrl, {
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    },
  );

  // Pattern 4: /{servers|s}/:server/mcp/.well-known/openid-configuration
  // Alternative path pattern where .well-known comes after /mcp
  app.get(
    "/:prefix{servers|s}/:server/mcp/.well-known/openid-configuration",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = getServer(registry, serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/openid-configuration`;

      return proxy(targetUrl, {
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    },
  );

  // Pattern 5: Root .well-known endpoints (without server in path)
  // These might be used for OAuth discovery before a specific server is selected
  // For now, return 404 or could proxy to a default server if configured
  app.get("/.well-known/oauth-protected-resource", (c) => {
    return c.json(
      {
        error: "server_not_specified",
        message:
          "Please specify a server: /.well-known/oauth-protected-resource/servers/:server/mcp or /s/:server/mcp",
      },
      400,
    );
  });

  app.get("/.well-known/oauth-authorization-server", (c) => {
    return c.json(
      {
        error: "server_not_specified",
        message:
          "Please specify a server: /.well-known/oauth-authorization-server/servers/:server/mcp or /s/:server/mcp",
      },
      400,
    );
  });

  // Pattern 6: OAuth Dynamic Client Registration
  // POST /register - this might need to be server-specific
  // For now, return helpful error
  app.post("/register", (c) => {
    return c.json(
      {
        error: "server_not_specified",
        message:
          "OAuth client registration requires a specific server. Use: /servers/:server/mcp/register or /s/:server/mcp/register",
      },
      400,
    );
  });

  // Pattern 7: /{servers|s}/:server/mcp/register - Dynamic Client Registration
  app.post(
    "/:prefix{servers|s}/:server/mcp/register",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = getServer(registry, serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/register`;

      // Get request body for POST
      const body = await c.req.text();

      return proxy(targetUrl, {
        method: "POST",
        headers: buildMinimalProxyHeaders(c.req.raw),
        body,
      });
    },
  );

  return app;
}

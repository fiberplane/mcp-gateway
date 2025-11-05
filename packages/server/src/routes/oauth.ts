import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { serverParamSchema } from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getGatewayBaseUrl,
  type ProtectedResourceMetadata,
  rewriteProtectedResourceMetadata,
} from "./oauth-rewriting";

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
export async function createOAuthRoutes(
  getServer: (name: string) => Promise<McpServer | undefined>,
): Promise<Hono> {
  const app = new Hono();

  // CORS configuration for OAuth discovery endpoints
  const OAUTH_CORS_CONFIG = {
    origin: "*" as const,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "MCP-Protocol-Version",
      "mcp-protocol-version",
    ],
  };

  // Helper to add CORS headers to response
  function addCorsHeaders(response: Response): void {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, MCP-Protocol-Version, mcp-protocol-version",
    );
  }

  // Enable CORS for all OAuth discovery endpoints
  app.use("/*", cors(OAUTH_CORS_CONFIG));

  // Helper to extract base URL from MCP server URL
  // E.g., "https://api.example.com/mcp" -> "https://api.example.com"
  // E.g., "https://mcp.linear.app/sse" -> "https://mcp.linear.app"
  function getBaseUrl(mcpUrl: string): string {
    try {
      const url = new URL(mcpUrl);
      // Remove the MCP endpoint path (/mcp or /sse)
      const pathWithoutEndpoint = url.pathname.replace(/\/(mcp|sse)\/?$/, "");
      return `${url.protocol}//${url.host}${pathWithoutEndpoint}`;
    } catch {
      // If URL parsing fails, return as-is
      return mcpUrl.replace(/\/(mcp|sse)\/?$/, "");
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

  // Helper to proxy request and rewrite CORS headers
  async function proxyWithCors(
    targetUrl: string,
    options: RequestInit,
  ): Promise<Response> {
    const response = await fetch(targetUrl, options);

    // Read body as text to avoid stream reuse issues with Transfer-Encoding
    const responseText = await response.text();

    // Create new response with cleaned headers
    const newHeaders = new Headers(response.headers);

    // Remove encoding/transfer headers since we're creating a fresh response
    newHeaders.delete("Content-Encoding");
    newHeaders.delete("Content-Length");
    newHeaders.delete("Transfer-Encoding");

    const newResponse = new Response(responseText, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

    // Add CORS headers
    addCorsHeaders(newResponse);

    return newResponse;
  }

  // Helper to proxy protected resource metadata and rewrite resource field
  async function proxyProtectedResourceWithRewriting(
    c: Context,
    targetUrl: string,
    serverName: string,
    pathPrefix: string,
  ): Promise<Response> {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: buildMinimalProxyHeaders(c.req.raw),
    });

    const responseText = await response.text();

    // If not 200, return as-is (error responses)
    if (response.status !== 200) {
      return proxyWithCors(targetUrl, {
        method: "GET",
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    }

    try {
      const metadata = JSON.parse(responseText) as ProtectedResourceMetadata;

      // Get gateway base URL from request
      const gatewayBase = getGatewayBaseUrl(c.req.header("Host"));

      // Rewrite only the resource field
      const rewritten = rewriteProtectedResourceMetadata(
        metadata,
        serverName,
        gatewayBase,
        pathPrefix,
      );

      // Return rewritten metadata with CORS
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("Content-Encoding");
      newHeaders.delete("Content-Length");
      newHeaders.delete("Transfer-Encoding");
      newHeaders.set("Content-Type", "application/json");

      const newResponse = new Response(JSON.stringify(rewritten), {
        status: 200,
        headers: newHeaders,
      });

      // Add CORS headers
      addCorsHeaders(newResponse);

      return newResponse;
    } catch (error) {
      // Log warning if parsing fails (upstream might return non-JSON)
      const logger = await import("@fiberplane/mcp-gateway-core").then(
        (m) => m.logger,
      );
      logger.warn("Failed to parse protected resource metadata", {
        targetUrl,
        serverName,
        error: error instanceof Error ? error.message : String(error),
        responsePreview: responseText.substring(0, 200),
      });

      // Return original response as fallback
      return proxyWithCors(targetUrl, {
        method: "GET",
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    }
  }

  // Pattern 1: /.well-known/oauth-protected-resource/{servers|s}/:server/mcp
  // Using Hono's named parameter regex to match both /servers/:server and /s/:server
  // Rewrites resource field to point to gateway for MCP Inspector validation
  app.get(
    "/.well-known/oauth-protected-resource/:prefix{servers|s}/:server/mcp",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName, prefix } = c.req.valid("param");
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

      return proxyProtectedResourceWithRewriting(
        c,
        targetUrl,
        serverName,
        prefix || "s",
      );
    },
  );

  // Pattern 2: /.well-known/oauth-authorization-server/{servers|s}/:server/mcp
  // This is the main OAuth discovery endpoint - proxy without rewriting for now
  app.get(
    "/.well-known/oauth-authorization-server/:prefix{servers|s}/:server/mcp",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

      // Proxy without rewriting URLs for now
      return proxyWithCors(targetUrl, {
        method: "GET",
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
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/openid-configuration`;

      return proxyWithCors(targetUrl, {
        method: "GET",
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
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/openid-configuration`;

      return proxyWithCors(targetUrl, {
        method: "GET",
        headers: buildMinimalProxyHeaders(c.req.raw),
      });
    },
  );

  // Pattern 5: /{servers|s}/:server/mcp/register - Dynamic Client Registration
  app.post(
    "/:prefix{servers|s}/:server/mcp/register",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/register`;

      // Get request body for POST
      const body = await c.req.text();

      return proxyWithCors(targetUrl, {
        method: "POST",
        headers: buildMinimalProxyHeaders(c.req.raw),
        body,
      });
    },
  );

  // Root .well-known endpoints - fallback when no server specified
  // Try to infer server from cookie (set during 401 response in proxy.ts)
  // If no cookie, return helpful error message

  // Helper to get server name from cookie
  function getServerFromCookie(c: Context): string | null {
    const cookieHeader = c.req.header("Cookie");
    if (!cookieHeader) {
      return null;
    }

    // Parse cookies with proper handling of values containing "="
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const trimmed = cookie.trim();
        const equalIndex = trimmed.indexOf("=");

        if (equalIndex === -1) {
          return acc; // Malformed cookie, skip
        }

        const key = trimmed.slice(0, equalIndex);
        const value = trimmed.slice(equalIndex + 1);

        if (key) {
          try {
            acc[key] = decodeURIComponent(value);
          } catch {
            // Skip malformed URI component
            acc[key] = value;
          }
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return cookies["mcp-gateway-server"] || null;
  }

  const rootWellKnownError = {
    error: "server_not_specified",
    error_description:
      "OAuth discovery requires a server context. Either include server in path or connect to a server first to set context.",
    preferred_paths: [
      "/.well-known/oauth-authorization-server/s/{server}/mcp",
      "/.well-known/oauth-protected-resource/s/{server}/mcp",
      "/.well-known/openid-configuration/s/{server}/mcp",
    ],
  };

  app.get("/.well-known/oauth-protected-resource", async (c) => {
    const serverName = getServerFromCookie(c);
    if (!serverName) {
      return c.json(rootWellKnownError, 400);
    }

    const server = await getServer(serverName);
    if (!server) {
      return c.json({ ...rootWellKnownError, error: "server_not_found" }, 404);
    }

    const baseUrl = getBaseUrl(server.url);
    const targetUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

    // Use short alias "s" for root endpoint (default)
    return proxyProtectedResourceWithRewriting(c, targetUrl, serverName, "s");
  });

  app.get("/.well-known/oauth-authorization-server", async (c) => {
    const serverName = getServerFromCookie(c);
    if (!serverName) {
      return c.json(rootWellKnownError, 400);
    }

    const server = await getServer(serverName);
    if (!server) {
      return c.json({ ...rootWellKnownError, error: "server_not_found" }, 404);
    }

    const baseUrl = getBaseUrl(server.url);
    const targetUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

    // Proxy without rewriting URLs for now
    return proxyWithCors(targetUrl, {
      method: "GET",
      headers: buildMinimalProxyHeaders(c.req.raw),
    });
  });

  app.get("/.well-known/openid-configuration", async (c) => {
    const serverName = getServerFromCookie(c);
    if (!serverName) {
      return c.json(rootWellKnownError, 400);
    }

    const server = await getServer(serverName);
    if (!server) {
      return c.json({ ...rootWellKnownError, error: "server_not_found" }, 404);
    }

    const baseUrl = getBaseUrl(server.url);
    const targetUrl = `${baseUrl}/.well-known/openid-configuration`;

    return proxyWithCors(targetUrl, {
      method: "GET",
      headers: buildMinimalProxyHeaders(c.req.raw),
    });
  });

  return app;
}

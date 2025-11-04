import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { serverParamSchema } from "@fiberplane/mcp-gateway-types";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";

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

  // Enable CORS for all OAuth discovery endpoints
  app.use(
    "/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

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

    // Override CORS headers to allow requests from any origin
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS",
    );
    newResponse.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );

    return newResponse;
  }

  // Pattern 1: /.well-known/oauth-protected-resource/{servers|s}/:server/mcp
  // Using Hono's named parameter regex to match both /servers/:server and /s/:server
  app.get(
    "/.well-known/oauth-protected-resource/:prefix{servers|s}/:server/mcp",
    sValidator("param", serverParamSchema),
    async (c) => {
      const { server: serverName } = c.req.valid("param");
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/oauth-protected-resource`;

      return proxyWithCors(targetUrl, {
        method: "GET",
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
      const server = await getServer(serverName);

      if (!server) {
        return c.notFound();
      }

      const baseUrl = getBaseUrl(server.url);
      const targetUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

      console.log("[OAuth Debug]", {
        serverName,
        serverUrl: server.url,
        baseUrl,
        targetUrl,
      });

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

  return app;
}

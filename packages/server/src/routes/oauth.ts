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
  // Derives values from OAUTH_CORS_CONFIG to maintain single source of truth
  function addCorsHeaders(response: Response): void {
    response.headers.set(
      "Access-Control-Allow-Origin",
      OAUTH_CORS_CONFIG.origin,
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      OAUTH_CORS_CONFIG.allowMethods.join(", "),
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      OAUTH_CORS_CONFIG.allowHeaders.join(", "),
    );
  }

  // Enable CORS for all OAuth discovery endpoints
  app.use("/*", cors(OAUTH_CORS_CONFIG));

  // Helper to extract base URL from MCP server URL using path manipulation
  // E.g., "https://api.example.com/v1/mcp" -> "https://api.example.com/v1"
  // E.g., "https://mcp.linear.app/sse" -> "https://mcp.linear.app"
  function getBaseUrl(mcpUrl: string): string {
    try {
      const url = new URL(mcpUrl);

      // Split path into segments, filter out empty strings
      const segments = url.pathname.split("/").filter((s) => s.length > 0);

      // Check if last segment is an MCP endpoint (mcp or sse)
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment === "mcp" || lastSegment === "sse") {
          // Remove the endpoint segment (like path.dirname behavior)
          segments.pop();
        }
      }

      // Reconstruct path (ensure leading slash, no trailing slash)
      const newPath = segments.length > 0 ? `/${segments.join("/")}` : "";

      return `${url.protocol}//${url.host}${newPath}`;
    } catch {
      // If URL parsing fails, return as-is (defensive fallback)
      return mcpUrl;
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
    cookieHeaderValue?: string,
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

    // Append cookie if provided (must use append to preserve existing Set-Cookie headers)
    if (cookieHeaderValue) {
      newHeaders.append("Set-Cookie", cookieHeaderValue);
    }

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
    cookieHeaderValue?: string,
  ): Promise<Response> {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: buildMinimalProxyHeaders(c.req.raw),
    });

    const responseText = await response.text();

    // If 404, try synthesizing from oauth-authorization-server
    if (response.status === 404) {
      const logger = await import("@fiberplane/mcp-gateway-core").then(
        (m) => m.logger,
      );
      logger.debug(
        "oauth-protected-resource not found, attempting synthesis from oauth-authorization-server",
        { targetUrl, serverName },
      );

      // Extract base URL and try oauth-authorization-server endpoint
      const baseUrl = targetUrl.replace(
        "/.well-known/oauth-protected-resource",
        "",
      );
      const authServerUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

      try {
        const authServerResponse = await fetch(authServerUrl, {
          method: "GET",
          headers: buildMinimalProxyHeaders(c.req.raw),
        });

        if (authServerResponse.status === 200) {
          const authServerText = await authServerResponse.text();
          const authServerMetadata = JSON.parse(authServerText) as {
            issuer?: string;
            [key: string]: unknown;
          };

          // Synthesize oauth-protected-resource from authorization server metadata
          const gatewayBase = getGatewayBaseUrl(c.req.header("Host"));
          const synthesized: ProtectedResourceMetadata = {
            resource: `${gatewayBase}/${pathPrefix}/${serverName}/mcp`,
            authorization_servers: authServerMetadata.issuer
              ? [authServerMetadata.issuer]
              : undefined,
          };

          logger.info(
            "Successfully synthesized oauth-protected-resource from oauth-authorization-server",
            { serverName, synthesized },
          );

          const newHeaders = new Headers();
          newHeaders.set("Content-Type", "application/json");

          // Append cookie if provided
          if (cookieHeaderValue) {
            newHeaders.append("Set-Cookie", cookieHeaderValue);
          }

          const newResponse = new Response(JSON.stringify(synthesized), {
            status: 200,
            headers: newHeaders,
          });

          addCorsHeaders(newResponse);
          return newResponse;
        }
      } catch (synthError) {
        logger.warn("Failed to synthesize oauth-protected-resource", {
          serverName,
          authServerUrl,
          error:
            synthError instanceof Error
              ? synthError.message
              : String(synthError),
        });
      }

      // Synthesis failed, return original 404
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("Content-Encoding");
      newHeaders.delete("Content-Length");
      newHeaders.delete("Transfer-Encoding");

      // Append cookie if provided
      if (cookieHeaderValue) {
        newHeaders.append("Set-Cookie", cookieHeaderValue);
      }

      const newResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

      addCorsHeaders(newResponse);
      return newResponse;
    }

    // If not 200 (and not 404), return as-is (error responses) with CORS headers
    if (response.status !== 200) {
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("Content-Encoding");
      newHeaders.delete("Content-Length");
      newHeaders.delete("Transfer-Encoding");

      // Append cookie if provided
      if (cookieHeaderValue) {
        newHeaders.append("Set-Cookie", cookieHeaderValue);
      }

      const newResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

      addCorsHeaders(newResponse);
      return newResponse;
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

      // Append cookie if provided
      if (cookieHeaderValue) {
        newHeaders.append("Set-Cookie", cookieHeaderValue);
      }

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

      // Return already-fetched response as fallback (no duplicate fetch)
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("Content-Encoding");
      newHeaders.delete("Content-Length");
      newHeaders.delete("Transfer-Encoding");

      // Append cookie if provided
      if (cookieHeaderValue) {
        newHeaders.append("Set-Cookie", cookieHeaderValue);
      }

      const newResponse = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });

      addCorsHeaders(newResponse);
      return newResponse;
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

      // Build cookie to track server context for root .well-known paths
      const cookie = buildServerCookie(serverName);

      return proxyProtectedResourceWithRewriting(
        c,
        targetUrl,
        serverName,
        prefix || "s",
        cookie,
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

      // Build cookie to track server context for root .well-known paths
      const cookie = buildServerCookie(serverName);

      // Proxy without rewriting URLs for now
      return proxyWithCors(
        targetUrl,
        {
          method: "GET",
          headers: buildMinimalProxyHeaders(c.req.raw),
        },
        cookie,
      );
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

      // Build cookie to track server context for root .well-known paths
      const cookie = buildServerCookie(serverName);

      return proxyWithCors(
        targetUrl,
        {
          method: "GET",
          headers: buildMinimalProxyHeaders(c.req.raw),
        },
        cookie,
      );
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

      // Build cookie to track server context for root .well-known paths
      const cookie = buildServerCookie(serverName);

      return proxyWithCors(
        targetUrl,
        {
          method: "GET",
          headers: buildMinimalProxyHeaders(c.req.raw),
        },
        cookie,
      );
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

      // Build cookie to track server context for root .well-known paths
      const cookie = buildServerCookie(serverName);

      return proxyWithCors(
        targetUrl,
        {
          method: "POST",
          headers: buildMinimalProxyHeaders(c.req.raw),
          body,
        },
        cookie,
      );
    },
  );

  // Root .well-known endpoints - fallback when no server specified
  // Try to infer server from cookie (set during 401 response in proxy.ts)
  // If no cookie, return helpful error message

  // Helper to generate server cookie value
  function buildServerCookie(serverName: string): string {
    // Server name validation: only alphanumeric, underscore, hyphen (safe for cookies)
    const cookieSafeName = /^[a-zA-Z0-9_-]+$/.test(serverName)
      ? serverName
      : encodeURIComponent(serverName);

    return `mcp-gateway-server=${cookieSafeName}; Path=/.well-known; HttpOnly; SameSite=Lax`;
  }

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

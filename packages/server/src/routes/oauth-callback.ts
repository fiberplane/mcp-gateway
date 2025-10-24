import {
  getServer,
  logger,
  saveRegistry,
  getStorageRoot,
} from "@fiberplane/mcp-gateway-core";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";
import { z } from "zod";

/**
 * OAuth callback handler
 * Handles the redirect from OAuth authorization server
 */
export function createOAuthCallbackRoutes(
  registry: Registry,
  storageDir?: string,
  options?: {
    onAuthComplete?: (serverName: string, token: string) => void;
    onRegistryUpdate?: () => void;
  },
): Hono {
  const app = new Hono();
  const storage = getStorageRoot(storageDir);

  // OAuth callback endpoint
  app.get("/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    // Handle OAuth error
    if (error) {
      logger.error("OAuth authorization failed", { error });
      return c.html(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error}</p>
            <p>You can close this window.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }

    // Validate required parameters
    if (!code || !state) {
      return c.html(`
        <html>
          <body>
            <h1>Invalid OAuth Callback</h1>
            <p>Missing required parameters (code or state)</p>
          </body>
        </html>
      `, 400);
    }

    try {
      // Parse state to get server name
      const stateData = JSON.parse(decodeURIComponent(state));
      const serverName = stateData.serverName;

      if (!serverName) {
        throw new Error("Missing serverName in state");
      }

      // Get server from registry
      const server = getServer(registry, serverName);
      if (!server) {
        throw new Error(`Server ${serverName} not found in registry`);
      }

      logger.info("Exchanging OAuth code for token", { serverName });

      // Fetch OAuth discovery to get token endpoint
      const baseUrl = server.url.replace(/\/mcp\/?$/, "");
      const discoveryUrl = `${baseUrl}/.well-known/oauth-authorization-server`;
      const discoveryRes = await fetch(discoveryUrl);

      if (!discoveryRes.ok) {
        throw new Error("Failed to fetch OAuth discovery document");
      }

      const discovery = (await discoveryRes.json()) as Record<string, unknown>;
      const tokenEndpoint = discovery.token_endpoint;

      if (!tokenEndpoint || typeof tokenEndpoint !== "string") {
        throw new Error("No token_endpoint in OAuth discovery");
      }

      // Exchange code for token
      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri: stateData.redirectUri || "http://localhost:3333/oauth/callback",
        client_id: stateData.clientId || "mcp-gateway",
      };

      // Add PKCE code_verifier (required for public clients)
      if (stateData.codeVerifier) {
        tokenParams.code_verifier = stateData.codeVerifier;
      }

      // Add client_secret if available (from DCR)
      if (server.oauthClientSecret) {
        tokenParams.client_secret = server.oauthClientSecret;
      }

      const tokenRes = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(tokenParams),
      });

      if (!tokenRes.ok) {
        const errorBody = await tokenRes.text();
        throw new Error(`Token exchange failed: ${tokenRes.status} ${errorBody}`);
      }

      const tokenData = (await tokenRes.json()) as Record<string, unknown>;
      const accessToken = tokenData.access_token;

      if (!accessToken || typeof accessToken !== "string") {
        throw new Error("No access_token in token response");
      }

      logger.info("Successfully obtained access token", { serverName });

      // Update server headers with token
      server.headers = {
        ...server.headers,
        Authorization: `Bearer ${accessToken}`,
      };

      // Clear auth error fields
      delete server.authUrl;
      delete server.authError;

      // Save updated registry
      await saveRegistry(storage, registry);

      logger.info("Saved access token to registry", { serverName });

      // Notify TUI of registry update
      if (options?.onRegistryUpdate) {
        options.onRegistryUpdate();
      }

      // Notify that auth is complete
      if (options?.onAuthComplete) {
        options.onAuthComplete(serverName, accessToken);
      }

      // Return success page
      return c.html(`
        <html>
          <head>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .success {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 400px;
              }
              .success h1 {
                color: #22c55e;
                margin-top: 0;
              }
              .success p {
                color: #666;
              }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✅ Authorization Successful!</h1>
              <p><strong>${serverName}</strong> has been authorized.</p>
              <p>The gateway will now reconnect automatically.</p>
              <p style="margin-top: 2rem; color: #999; font-size: 0.875rem;">
                You can close this window.
              </p>
            </div>
            <script>
              // Auto-close after 3 seconds
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      logger.error("OAuth callback processing failed", { error: String(error) });
      return c.html(`
        <html>
          <body>
            <h1>Authorization Failed</h1>
            <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
            <p>You can close this window.</p>
          </body>
        </html>
      `, 500);
    }
  });

  return app;
}

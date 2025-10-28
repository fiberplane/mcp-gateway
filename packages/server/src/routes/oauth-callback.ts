import {
  getServer,
  logger,
  saveRegistry,
  getStorageRoot,
} from "@fiberplane/mcp-gateway-core";
import type { ClientManager } from "@fiberplane/mcp-gateway-core";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import { Hono } from "hono";

/**
 * OAuth callback handler
 * Handles the redirect from OAuth authorization server
 * Uses mcp-lite's completeAuthorizationFlow for token exchange
 */
export function createOAuthCallbackRoutes(
  registry: Registry,
  clientManager: ClientManager,
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

      logger.info("Completing OAuth authorization flow", { serverName });

      // Get transport for this server
      const transport = clientManager.getTransport(serverName);
      if (!transport) {
        throw new Error(`No transport found for server ${serverName}`);
      }

      // Let mcp-lite handle the token exchange!
      await transport.completeAuthorizationFlow(server.url, code, state);

      logger.info("Successfully obtained access token", { serverName });

      // Clear auth error fields (token is stored by adapter)
      delete server.authUrl;
      delete server.authError;
      await saveRegistry(storage, registry);

      // Notify TUI of registry update
      if (options?.onRegistryUpdate) {
        options.onRegistryUpdate();
      }

      // Notify that auth is complete
      if (options?.onAuthComplete && server.oauthToken) {
        options.onAuthComplete(serverName, server.oauthToken);
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
              setTimeout(() => { window.close(); }, 3000);
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

/**
 * MCP Gateway CLI - Headless HTTP server for proxying and observing MCP traffic
 */

import { access, constants, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createApp as createApiApp } from "@fiberplane/mcp-gateway-api";
import {
  createGateway,
  createRequestCaptureRecord,
  createResponseCaptureRecord,
  getStorageRoot,
  logger,
} from "@fiberplane/mcp-gateway-core";
import { createMcpApp } from "@fiberplane/mcp-gateway-management-mcp";
import { createApp as createServerApp } from "@fiberplane/mcp-gateway-server";
import type { ProxyDependencies } from "@fiberplane/mcp-gateway-types";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createAuthMiddleware } from "./middleware/auth";
import { loadOrGenerateToken } from "./utils/token";
import { getVersion } from "./utils/version.js";

/**
 * Maximum number of logs to fetch for session summary
 */
const MAX_SESSION_LOGS = 10000;

/**
 * Get health icon for display
 */
function getHealthIcon(health: string): string {
  return health === "up" ? "✓" : health === "down" ? "✗" : "?";
}

/**
 * Find the public directory containing web UI assets.
 * Located at packages/mcp-gateway/public/ (built from packages/web/dist/)
 */
function findPublicDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "public");
}

function showHelp(): void {
  // biome-ignore lint/suspicious/noConsole: actually want to print to console
  console.log(`
Usage: mcp-gateway [options]

Description:
  HTTP server for proxying and observing MCP traffic

Options:
  -h, --help                    Show help
  -v, --version                 Show version
  --port <number>               Port to run the gateway server on
                               (default: 3333)
  --storage-dir <path>          Storage directory for registry and captures
                               (default: ~/.mcp-gateway)

Examples:
  mcp-gateway
  mcp-gateway --port 8080
  mcp-gateway --storage-dir /tmp/mcp-data
  mcp-gateway --help
  mcp-gateway --version
`);
}

function showVersion(): void {
  const version = getVersion();
  // biome-ignore lint/suspicious/noConsole: actually want to print to console
  console.log(`mcp-gateway v${version}`);
}

export async function runCli(): Promise<void> {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        help: {
          type: "boolean",
          short: "h",
          default: false,
        },
        version: {
          type: "boolean",
          short: "v",
          default: false,
        },
        port: {
          type: "string",
          default: "3333",
        },
        "storage-dir": {
          type: "string",
          default: undefined,
        },
      },
      allowPositionals: false,
    });

    if (values.help) {
      showHelp();
      return;
    }

    if (values.version) {
      showVersion();
      return;
    }

    // Parse and validate port
    const port = Number.parseInt(values.port || "3333", 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error(
        `Invalid port number: ${values.port}. Must be between 1 and 65535.`,
      );
    }

    // Get storage directory
    const storageDir = getStorageRoot(values["storage-dir"]);

    // Initialize logger
    await logger.initialize(storageDir);

    // Create Gateway instance with scoped storage and state
    const gateway = await createGateway({ storageDir });

    // Track when this session started for shutdown traffic summary
    const sessionStartTime = new Date().toISOString();

    // Wire Gateway methods into ProxyDependencies for server
    const proxyDependencies: ProxyDependencies = {
      createRequestRecord: (
        serverName,
        sessionId,
        request,
        httpContext,
        clientInfo,
        serverInfo,
        methodDetail,
      ) =>
        createRequestCaptureRecord(
          serverName,
          sessionId,
          request,
          httpContext,
          clientInfo,
          serverInfo,
          gateway.requestTracker,
          methodDetail,
        ),
      createResponseRecord: (
        serverName,
        sessionId,
        response,
        httpStatus,
        method,
        httpContext,
        clientInfo,
        serverInfo,
        methodDetail,
      ) =>
        createResponseCaptureRecord(
          serverName,
          sessionId,
          response,
          httpStatus,
          method,
          httpContext,
          clientInfo,
          serverInfo,
          gateway.requestTracker,
          methodDetail,
        ),
      appendRecord: (record) => gateway.capture.append(record),
      captureErrorResponse: (
        serverName,
        sessionId,
        request,
        error,
        httpStatus,
        durationMs,
      ) =>
        gateway.capture.error(
          serverName,
          sessionId,
          request,
          error,
          httpStatus,
          durationMs,
        ),
      captureSSEEventData: (
        serverName,
        sessionId,
        sseEvent,
        method,
        requestId,
      ) =>
        gateway.capture.sseEvent(
          serverName,
          sessionId,
          sseEvent,
          method,
          requestId,
        ),
      captureSSEJsonRpcMessage: (
        serverName,
        sessionId,
        jsonRpcMessage,
        sseEvent,
        isResponse,
        httpContext,
        clientInfo,
        serverInfo,
      ) =>
        gateway.capture.sseJsonRpc(
          serverName,
          sessionId,
          jsonRpcMessage,
          sseEvent,
          isResponse,
          httpContext,
          clientInfo,
          serverInfo,
        ),
      storeClientInfoForSession: (sessionId, info) =>
        gateway.clientInfo.store(sessionId, info),
      getClientInfoForSession: (sessionId) => gateway.clientInfo.get(sessionId),
      storeServerInfoForSession: (sessionId, info) =>
        gateway.serverInfo.store(sessionId, info),
      getServerInfoForSession: (sessionId) => gateway.serverInfo.get(sessionId),
      updateServerInfoForInitializeRequest: (
        serverName,
        sessionId,
        requestId,
        serverInfo,
      ) =>
        gateway.storage.updateServerInfoForInitializeRequest(
          serverName,
          sessionId,
          requestId,
          serverInfo,
        ),
      getServer: (name) => gateway.storage.getServer(name),
    };

    // Create MCP protocol server (proxy, OAuth)
    const { app: serverApp } = await createServerApp({
      storageDir,
      appLogger: logger,
      proxyDependencies,
      gateway,
    });

    // Create main application that orchestrates everything
    const app = new Hono();

    // Generate or load authentication token
    const authToken = loadOrGenerateToken();
    const authMiddleware = createAuthMiddleware(authToken);

    // Add landing page at root
    const publicDir = findPublicDir();
    app.get("/", (c) => {
      const version = getVersion();
      return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Gateway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: "Inter", system-ui, -apple-system, sans-serif;
      background: #ffffff;
      color: #000000;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .container {
      max-width: 500px;
      text-align: center;
    }

    .header {
      margin-bottom: 10px;
    }

    h1 {
      font-size: 36px;
      font-weight: 700;
      color: #272624;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .version {
      display: inline-block;
      background: #f9fafb;
      color: #6b7280;
      font-size: 13px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      margin-bottom: 24px;
    }

    p {
      font-size: 15px;
      line-height: 1.6;
      color: #6b7280;
      padding: 0;
      margin-bottom: 16px;
    }

    .button {
      display: inline-block;
      background: #272624;
      color: #ffffff;
      padding: 12px 28px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: all 0.2s;
      border: 1px solid #272624;
      cursor: pointer;
    }

    .button:hover {
      background: #1a1817;
      border-color: #1a1817;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(39, 38, 36, 0.15);
    }

    .auth-section {
      text-align: start;
    }

    .auth-title {
      font-size: 13px;
      font-weight: 600;
      color: #272624;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .auth-note {
      font-size: 14px;
      line-height: 1.6;
      color: #6b7280;
      margin-bottom: 16px;
    }

    .terminal-example {
      background: #1a1817;
      color: #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      font-family: "Roboto Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
      margin-top: 16px;
      margin-bottom: 10px;
      text-align: left;
      overflow-x: auto;
      white-space: pre;
      word-break: break-all;
      white-space: pre-wrap;
    }

    .terminal-example .token-line {
      color: #10b981;
    }

    .endpoints-section {
      margin-top: 32px;
    }

    .endpoints-title {
      font-size: 13px;
      font-weight: 600;
      color: #272624;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }

    .endpoints {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
      text-align: left;
      font-family: "Roboto Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.8;
      color: #6b7280;
    }

    .endpoint-item {
      padding: 4px 0;
    }

    .endpoint-method {
      color: #8b5cf6;
      font-weight: 600;
    }

    .endpoint-protected {
      color: #f59e0b;
      font-size: 11px;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MCP Gateway</h1>
      <div class="version">v${version}</div>
    </div>
    
    <div class="auth-section">
    <p>To access the web interface, copy the Web UI URL from your terminal output:</p>
      <div class="terminal-example">mcp-gateway v${version}

MCP Gateway server started at http://localhost:${port}
<span class="token-line">Web UI: http://localhost:${port}/ui?token=•••••••••••••••••••••••••</span></div>
      <div class="auth-note">
        The URL includes your authentication token. For API access, use the token shown in your terminal.
      </div>
    </div>

    <div class="endpoints-section">
      <div class="endpoints-title">Available Endpoints</div>
      <div class="endpoints">
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/logs<span class="endpoint-protected">🔒 auth required</span></div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/servers<span class="endpoint-protected">🔒 auth required</span></div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/sessions<span class="endpoint-protected">🔒 auth required</span></div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/clients<span class="endpoint-protected">🔒 auth required</span></div>
        <div class="endpoint-item"><span class="endpoint-method">POST</span> /api/logs/clear<span class="endpoint-protected">🔒 auth required</span></div>
        <div class="endpoint-item"><span class="endpoint-method">POST</span> /gateway/mcp<span class="endpoint-protected">🔒 auth required</span></div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /ui - Web interface <span class="endpoint-protected">🔒 requires token in URL</span></div>
      </div>
    </div>
  </div>
</body>
</html>
        `);
    });

    // Mount the MCP protocol server
    app.route("/", serverApp);

    // Mount API for observability (query logs, servers, sessions, clients)
    const apiApp = createApiApp({
      queries: {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => {
          // Return ServerInfo[] including status for Web UI
          return await gateway.storage.getServers();
        },
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        getMethods: (serverName) => gateway.storage.getMethods(serverName),
        clearSessions: async () => {
          // Clear in-memory session metadata
          gateway.clientInfo.clearAll();
          gateway.serverInfo.clearAll();
          // Clear all logs from database
          await gateway.storage.clearAll();
        },
      },
      logger,
      serverManagement: {
        getRegisteredServers: () => gateway.storage.getRegisteredServers(),
        addServer: (config) => gateway.storage.addServer(config),
        updateServer: (name, changes) =>
          gateway.storage.updateServer(name, changes),
        removeServer: (name) => gateway.storage.removeServer(name),
        checkServerHealth: async (name) => {
          // Trigger manual health check for specific server
          // Throws ServerNotFoundError if server doesn't exist
          await gateway.health.checkOne(name);
          // Return updated server info (throws ServerNotFoundError if not found)
          return await gateway.storage.getServer(name);
        },
      },
    });

    // Wrap REST API with authentication
    const protectedApi = new Hono();
    protectedApi.use("/*", authMiddleware);
    protectedApi.route("/", apiApp);
    app.route("/api", protectedApi);

    // Wrap gateway management MCP server with authentication
    const managementMcpApp = createMcpApp(gateway);
    const protectedMcp = new Hono();
    protectedMcp.use("/*", authMiddleware);
    protectedMcp.route("/", managementMcpApp);
    app.route("/gateway", protectedMcp);
    // Short alias for gateway management MCP server
    app.route("/g", protectedMcp);

    // Serve Web UI for management
    // Check if public directory exists before mounting static file middleware
    let hasWebUI = false;
    try {
      await access(publicDir, constants.F_OK);
      hasWebUI = true;
    } catch {
      // Public directory doesn't exist - web UI not built yet
      logger.error("Web UI not available", { publicDir });
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.error(
        "\nWeb UI not available. Assuming you are running the CLI from source: you should run `bun run build` in the root of the monorepo.\n",
      );
    }

    // Only serve static files if web UI is built
    if (hasWebUI) {
      app.use(
        "/ui/*",
        serveStatic({
          root: publicDir,
          rewriteRequestPath: (path) => path.replace(/^\/ui/, ""),
        }),
      );
    }

    // Serve index.html for /ui root
    app.get("/ui", async (c) => {
      const indexPath = `${publicDir}/index.html`;
      try {
        const html = await readFile(indexPath, "utf-8");
        return c.html(html);
      } catch {
        return c.text(
          "Web UI not available. Assuming you are running the CLI from source: you should run `bun run build` in the root of the monorepo. ",
          404,
        );
      }
    });

    // Fallback to index.html for SPA client-side routing under /ui
    app.get("/ui/*", async (c) => {
      const indexPath = `${publicDir}/index.html`;
      try {
        const html = await readFile(indexPath, "utf-8");
        return c.html(html);
      } catch {
        return c.text("Web UI not available", 404);
      }
    });

    // Track previous health states to only show changes
    const previousHealthStates = new Map<string, string>();

    // Start health checks BEFORE server starts to ensure accurate initial status
    // This runs the first health check synchronously before any Web UI requests can be made
    // Health check interval: 5 seconds (5000ms)
    await gateway.health.start(5000, (updates) => {
      // Show health status changes to the user (only when state actually changes)
      for (const { name, health } of updates) {
        const previousHealth = previousHealthStates.get(name);

        // Only log if this is a state change (not the initial check or same state)
        if (previousHealth !== undefined && previousHealth !== health) {
          const icon = getHealthIcon(health);
          // biome-ignore lint/suspicious/noConsole: actually want to print to console
          console.log(`${icon} server "${name}" is now ${health}`);
        }

        // Update tracked state
        previousHealthStates.set(name, health);
      }
    });

    // Start server and wait for it to be listening or error
    const server = serve({
      fetch: app.fetch,
      port,
    });

    // Wait for server to start or fail
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 5000);

      // @hono/node-server returns a Node.js HTTP server
      if (server.on) {
        server.on("listening", () => {
          clearTimeout(timeout);
          resolve();
        });
        server.on("error", (err: NodeJS.ErrnoException) => {
          clearTimeout(timeout);
          reject(err);
        });
      } else {
        // Fallback if server doesn't have event emitters
        clearTimeout(timeout);
        resolve();
      }
    }).catch((serverError) => {
      const err = serverError as NodeJS.ErrnoException;
      if (err.code === "EADDRINUSE") {
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.error(`✗ Port ${port} is already in use`);
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.error(
          `  Try running with a different port: mcp-gateway --port ${port + 1}`,
        );
      } else if (err.code === "EACCES") {
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.error(`✗ Permission denied to bind to port ${port}`);
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.error(
          "  Try using a port above 1024 or run with appropriate permissions",
        );
      } else {
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.error(`✗ Failed to start server: ${err.message || err}`);
      }
      process.exit(1);
    });

    const version = getVersion();
    // biome-ignore lint/suspicious/noConsole: actually want to print to console
    console.log(`mcp-gateway v${version}\n`);
    // biome-ignore lint/suspicious/noConsole: actually want to print to console
    console.log(`MCP Gateway server started at http://localhost:${port}`);
    // biome-ignore lint/suspicious/noConsole: actually want to print to console
    console.log(`Web UI: http://localhost:${port}/ui?token=${authToken}`);

    // Show configured MCP servers and their gateway endpoints
    const registeredServers = await gateway.storage.getRegisteredServers();
    if (registeredServers.length === 0) {
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.log(`\n  No servers configured yet - add servers via Web UI`);
    } else {
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.log(`\nConfigured MCP servers:`);

      // Calculate column widths for alignment
      const maxNameLen = Math.max(
        ...registeredServers.map((s) => s.name.length),
      );
      const maxGatewayLen = Math.max(
        ...registeredServers.map(
          (s) => `http://localhost:${port}/s/${s.name}/mcp`.length,
        ),
      );
      const maxUpstreamLen = Math.max(
        ...registeredServers.map((s) => s.url.length),
      );

      for (const server of registeredServers) {
        const gatewayUrl = `http://localhost:${port}/s/${server.name}/mcp`;
        const upstreamUrl = server.url;
        const healthStatus = server.health || "unknown";
        const healthIcon = getHealthIcon(healthStatus);

        // Pad columns for alignment
        const name = server.name.padEnd(maxNameLen);
        const gateway = gatewayUrl.padEnd(maxGatewayLen);
        const upstream = upstreamUrl.padEnd(maxUpstreamLen);

        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.log(
          `  ${name}  ${gateway}  →  ${upstream}  [${healthIcon} ${healthStatus}]`,
        );
      }
      // biome-ignore lint/suspicious/noConsole: print a new line
      console.log("");
    }

    logger.info("MCP Gateway server started", { port });

    // Keep process alive and handle graceful shutdown signals
    const shutdown = async () => {
      try {
        // Show traffic summary for this session only (after sessionStartTime)
        const result = await gateway.storage.query({
          after: sessionStartTime,
          limit: MAX_SESSION_LOGS,
        });

        const totalRequests = result.data.length;

        if (totalRequests > 0) {
          // Warn if results might be truncated
          if (totalRequests === MAX_SESSION_LOGS) {
            logger.warn?.(
              `Session summary may be incomplete (reached limit of ${MAX_SESSION_LOGS} logs)`,
            );
          }

          // Count requests per server
          const sessionTraffic = new Map<string, number>();
          for (const log of result.data) {
            const serverName = log.metadata.serverName;
            const count = sessionTraffic.get(serverName) || 0;
            sessionTraffic.set(serverName, count + 1);
          }

          // biome-ignore lint/suspicious/noConsole: actually want to print to console
          console.log("Log summary:");
          // Iterate over sessionTraffic to show all servers that handled traffic, even if removed
          for (const [serverName, count] of sessionTraffic.entries()) {
            // biome-ignore lint/suspicious/noConsole: actually want to print to console
            console.log(`* ${serverName}: ${count} log events`);
          }
          // biome-ignore lint/suspicious/noConsole: actually want to print to console
          console.log("");
        } else {
          // biome-ignore lint/suspicious/noConsole: actually want to print to console
          console.log("\nNo traffic captured during this session\n");
        }
      } catch (error) {
        // Log error at debug level to aid troubleshooting, but don't block shutdown
        logger.debug?.("Error during shutdown summary", { error });
      }

      await gateway.close(); // Close Gateway connections (includes stopping health checks)
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    };

    process.on("SIGTERM", async () => {
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.log("\nReceived SIGTERM, shutting down...");
      await shutdown();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.log("\nReceived SIGINT, shutting down...");
      await shutdown();
      process.exit(0);
    });
  } catch (error) {
    if (error instanceof Error) {
      // print error message to user
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.error("CLI error:", error.message);

      // Also log the error message and stack to the log files
      logger.error("CLI error", {
        message: error.message,
        stack: error.stack,
      });
    }

    // print message to user on how to look up usage
    // biome-ignore lint/suspicious/noConsole: actually want to print to console
    console.error("Run with --help for usage information");
    process.exit(1);
  }
}

// Auto-run if this is the main module
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli();
}

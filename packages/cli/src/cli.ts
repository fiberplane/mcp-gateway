/**
 * Run script for OpenTUI version (v2)
 * This is identical to run.ts but uses the new OpenTUI interface
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createApp as createApiApp } from "@fiberplane/mcp-gateway-api";
import {
  createGateway,
  createMcpApp,
  createRequestCaptureRecord,
  createResponseCaptureRecord,
  getStorageRoot,
  loadRegistry,
  logger,
} from "@fiberplane/mcp-gateway-core";

import { createApp as createServerApp } from "@fiberplane/mcp-gateway-server";
import type { Context, ProxyDependencies } from "@fiberplane/mcp-gateway-types";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { emitLog, emitRegistryUpdate, tuiEvents } from "./events.js";
import { runOpenTUI } from "./tui/App.js";
import { useAppStore } from "./tui/store.js";
import { getVersion } from "./utils/version.js";

/**
 * Find the public directory containing web UI assets.
 * In development: packages/cli/public/
 * In binary: relative to the executable
 */
function findPublicDir(): string | undefined {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Try relative to the CLI source directory (development)
  const devPublicDir = join(__dirname, "..", "public");
  if (existsSync(devPublicDir)) {
    return devPublicDir;
  }

  // Try relative to the executable (binary)
  const binaryPublicDir = join(process.execPath, "..", "public");
  if (existsSync(binaryPublicDir)) {
    return binaryPublicDir;
  }

  // Web UI not available
  return undefined;
}

function showHelp(): void {
  // biome-ignore lint/suspicious/noConsole: actually want to print to console
  console.log(`
Usage: mcp-gateway [options]

Description:
  Interactive CLI for managing MCP servers and running the gateway

Options:
  -h, --help                    Show help
  -v, --version                 Show version
  --port <number>               Port to run the gateway server on
                               (default: 3333)
  --storage-dir <path>          Storage directory for registry and captures
                               (default: ~/.mcp-gateway)
  --no-tui                      Run in headless mode without terminal UI
                               (default: false, auto-detects TTY)

Examples:
  mcp-gateway
  mcp-gateway --port 8080
  mcp-gateway --storage-dir /tmp/mcp-data
  mcp-gateway --no-tui
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
        "no-tui": {
          type: "boolean",
          default: false,
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

    // Load registry once and share it between server and CLI
    const registry = await loadRegistry(storageDir);

    // Create Gateway instance with scoped storage and state
    const gateway = await createGateway({ storageDir });

    // Wire Gateway methods into ProxyDependencies for server
    const proxyDependencies: ProxyDependencies = {
      createRequestRecord: (
        serverName,
        sessionId,
        request,
        httpContext,
        clientInfo,
        serverInfo,
      ) =>
        createRequestCaptureRecord(
          serverName,
          sessionId,
          request,
          httpContext,
          clientInfo,
          serverInfo,
          gateway.requestTracker,
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

    // Create MCP protocol server (proxy, OAuth, gateway MCP server)
    const { app: serverApp } = await createServerApp({
      registry,
      storageDir,
      createMcpApp,
      logger,
      proxyDependencies,
      gateway,
      onLog: emitLog,
      onRegistryUpdate: emitRegistryUpdate,
    });

    // Create main application that orchestrates everything
    const app = new Hono();

    // Add landing page at root if web UI is available
    const publicDir = findPublicDir();
    if (publicDir) {
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
      margin-bottom: 40px;
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
      margin-bottom: 32px;
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

    .endpoints-section {
      margin-top: 40px;
      padding-top: 40px;
      border-top: 1px solid #e5e7eb;
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MCP Gateway</h1>
      <div class="version">v${version}</div>
    </div>

    <p>Access the web interface to view and analyze all captured MCP traffic and interactions.</p>

    <a href="/ui" class="button">Open Web UI</a>

    <div class="endpoints-section">
      <div class="endpoints-title">Available Endpoints</div>
      <div class="endpoints">
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/logs - Query captured logs</div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/servers - List MCP servers</div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/sessions - List sessions</div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /api/clients - List clients</div>
        <div class="endpoint-item"><span class="endpoint-method">POST</span> /api/logs/clear - Clear captured logs</div>
        <div class="endpoint-item"><span class="endpoint-method">GET</span> /ui - Web interface</div>
      </div>
    </div>
  </div>
</body>
</html>
        `);
      });
    }

    // Mount the MCP protocol server
    app.route("/", serverApp);

    // Mount API for observability (query logs, servers, sessions, clients)
    const apiApp = createApiApp(
      {
        queryLogs: (options) => gateway.storage.query(options),
        getServers: async () => {
          // Map ServerInfo[] to Omit<ServerInfo, 'status'>[] by removing status field
          const servers = await gateway.storage.getServers();
          return servers.map(({ status: _, ...rest }) => rest);
        },
        getSessions: (serverName) => gateway.storage.getSessions(serverName),
        getClients: () => gateway.storage.getClients(),
        clearSessions: async () => {
          // Clear in-memory session metadata
          gateway.clientInfo.clearAll();
          gateway.serverInfo.clearAll();
          // Clear all logs from database
          await gateway.storage.clearAll();
        },
      },
      logger,
    );
    app.route("/api", apiApp);

    // Serve Web UI for management (if available)
    if (publicDir) {
      // Serve static files under /ui prefix
      app.use(
        "/ui/*",
        serveStatic({
          root: publicDir,
          rewriteRequestPath: (path) => path.replace(/^\/ui/, ""),
        }),
      );

      // Serve index.html for /ui root
      app.get("/ui", async (c) => {
        const indexPath = `${publicDir}/index.html`;
        try {
          const file = Bun.file(indexPath);
          const html = await file.text();
          return c.html(html);
        } catch {
          return c.text("Web UI not available", 404);
        }
      });

      // Fallback to index.html for SPA client-side routing under /ui
      app.get("/ui/*", async (c) => {
        const indexPath = `${publicDir}/index.html`;
        try {
          const file = Bun.file(indexPath);
          const html = await file.text();
          return c.html(html);
        } catch {
          return c.text("Web UI not available", 404);
        }
      });
    }

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

    // biome-ignore lint/suspicious/noConsole: actually want to print to console
    console.log(`✓ MCP Gateway server started at http://localhost:${port}`);
    logger.info("MCP Gateway server started", { port });

    // Start health checks with callback to update store
    await gateway.health.start(30000, (updates) => {
      const updateServerHealth = useAppStore.getState().updateServerHealth;
      // Update UI state for each health check result
      for (const update of updates) {
        updateServerHealth(update.name, update.health, update.lastHealthCheck);
      }
    });

    // Create context for TUI
    const context: Context = {
      storageDir,
      port,
      gateway,
      onExit: async () => {
        await gateway.close(); // Close Gateway connections (includes stopping health checks)
        return new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      },
    };

    // Start TUI only if running in a TTY and --no-tui flag is not set
    if (process.stdin.isTTY && !values["no-tui"]) {
      // Listen for registry updates and reload into HTTP server's registry
      tuiEvents.on("action", async (action) => {
        if (action.type === "registry_updated") {
          logger.debug("Registry update event received in HTTP server");
          const updatedRegistry = await loadRegistry(storageDir);

          // Mutate the registry object in place so HTTP server sees the changes
          registry.servers.length = 0;
          registry.servers.push(...updatedRegistry.servers);

          logger.debug("Registry reloaded in HTTP server", {
            serverCount: registry.servers.length,
          });
        }
      });

      logger.info("Starting UI", { version: getVersion() });
      await runOpenTUI(context, registry);
    } else {
      const reason = !process.stdin.isTTY
        ? "no TTY detected"
        : "--no-tui flag set";
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.log(
        `Running in headless mode (${reason}). Server will run until terminated.`,
      );
      // Keep process alive and handle signals
      process.on("SIGTERM", async () => {
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.log("\nReceived SIGTERM, shutting down...");
        await context.onExit?.();
        process.exit(0);
      });
      process.on("SIGINT", async () => {
        // biome-ignore lint/suspicious/noConsole: actually want to print to console
        console.log("\nReceived SIGINT, shutting down...");
        await context.onExit?.();
        process.exit(0);
      });
    }
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

// Auto-run if this is the main module (but not in compiled binary)
// Compiled binaries use binary-entry.ts as the entry point
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  // @ts-expect-error - BUILD_VERSION is defined by --define flag during binary build
  typeof BUILD_VERSION === "undefined"
) {
  runCli();
}

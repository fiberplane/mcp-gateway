/**
 * Run script for OpenTUI version (v2)
 * This is identical to run.ts but uses the new OpenTUI interface
 */

import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  getStorageRoot,
  loadRegistry,
  logger,
  startHealthChecks,
} from "@fiberplane/mcp-gateway-core";
import { createApp } from "@fiberplane/mcp-gateway-server";
import type { Context } from "@fiberplane/mcp-gateway-types";
import { serve } from "@hono/node-server";
import { emitLog, emitRegistryUpdate } from "./events.js";
import { runOpenTUI } from "./tui/App.js";
import { useAppStore } from "./tui/store.js";
import { getVersion } from "./utils/version.js";

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
  --enable-mcp-client           Use MCP client architecture (experimental,
                               enables optimization)

Examples:
  mcp-gateway
  mcp-gateway --port 8080
  mcp-gateway --storage-dir /tmp/mcp-data
  mcp-gateway --enable-mcp-client
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
        "enable-mcp-client": {
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

    // Start HTTP server with event handlers for TUI
    const { app, clientManager } = await createApp(registry, storageDir, {
      onLog: emitLog,
      onRegistryUpdate: emitRegistryUpdate,
      enableMcpClient: values["enable-mcp-client"],
      port,
    });

    // Store clientManager in app store for optimization evaluations
    if (clientManager) {
      useAppStore.setState({ clientManager });
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
    const stopHealthChecks = await startHealthChecks(
      registry,
      30000,
      (updates) => {
        const updateServerHealth = useAppStore.getState().updateServerHealth;
        // Update UI state for each health check result
        for (const update of updates) {
          updateServerHealth(
            update.name,
            update.health,
            update.lastHealthCheck,
          );
        }
      },
    );

    // Create context for TUI
    const context: Context = {
      storageDir,
      port,
      onExit: () => {
        stopHealthChecks();
        return new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      },
    };

    // Start TUI only if running in a TTY
    if (process.stdin.isTTY) {
      // Listen for registry updates and reload into HTTP server's registry
      const { tuiEvents } = await import("./events.js");
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
      // biome-ignore lint/suspicious/noConsole: actually want to print to console
      console.log(
        "Running in headless mode (no TTY detected). Server will run until terminated.",
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

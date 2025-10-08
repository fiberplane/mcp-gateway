import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { serve } from "@hono/node-server";
import { startHealthChecks } from "./health.js";
import { logger } from "./logger.js";
import { createApp } from "./server/index.js";
import { getStorageRoot, loadRegistry } from "./storage.js";
import { runTUI } from "./tui/loop.js";
import type { Context } from "./tui/state.js";

function showHelp(): void {
  console.log(`
Usage: mcp-gateway [options]

Description:
  Interactive CLI for managing MCP servers and running the gateway

Options:
  -h, --help                    Show help
  -v, --version                 Show version
  --storage-dir <path>          Storage directory for registry and captures
                               (default: ~/.mcp-gateway)

Examples:
  mcp-gateway
  mcp-gateway --storage-dir /tmp/mcp-data
  mcp-gateway --help
  mcp-gateway --version
`);
}

function showVersion(): void {
  // Read version from package.json
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, "../package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  console.log(`mcp-gateway v${packageJson.version}`);
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

    // Get storage directory
    const storageDir = getStorageRoot(values["storage-dir"]);

    // Initialize logger
    await logger.initialize(storageDir);

    // Load registry once and share it between server and CLI
    const registry = await loadRegistry(storageDir);

    // Start HTTP server
    const { app } = await createApp(registry, storageDir);
    const port = 3333;

    const server = serve({
      fetch: app.fetch,
      port,
    });

    console.log(`MCP Gateway server started at http://localhost:${port}`);

    // Start health checks
    const stopHealthChecks = await startHealthChecks(registry);

    // Create context for TUI
    const context: Context = {
      storageDir,
      onExit: () => {
        stopHealthChecks();
        server.close();
      },
    };

    // Start TUI only if running in a TTY
    if (process.stdin.isTTY) {
      runTUI(context, registry).catch((error) => {
        logger.error("TUI error", { error: String(error) });
        stopHealthChecks();
        server.close();
        process.exit(1);
      });
    } else {
      console.log(
        "Running in headless mode (no TTY detected). Server will run until terminated.",
      );
      // Keep process alive and handle signals
      process.on("SIGTERM", () => {
        console.log("\nReceived SIGTERM, shutting down...");
        context.onExit?.();
        process.exit(0);
      });
      process.on("SIGINT", () => {
        console.log("\nReceived SIGINT, shutting down...");
        context.onExit?.();
        process.exit(0);
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      // print error message to user
      console.error("CLI error:", error.message);

      // Also log the error message and stack to the log files
      logger.error("CLI error", {
        message: error.message,
        stack: error.stack,
      });
    }

    // print message to user on how to look up usage
    console.error("Run with --help for usage information");
    process.exit(1);
  }
}

// Auto-run if this is the main module
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runCli();
}

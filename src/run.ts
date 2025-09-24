import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { runInteractiveCli } from "./cli.js";
import { createApp } from "./server.js";
import { getStorageRoot, loadRegistry } from "./storage.js";

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
      args: Bun.argv.slice(2),
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

    // Load registry once and share it between server and CLI
    const registry = await loadRegistry(storageDir);

    // Start HTTP server
    const { app } = await createApp(registry, storageDir);
    const port = 3333;

    const server = Bun.serve({
      port,
      fetch: app.fetch,
    });

    console.log(`MCP Gateway server started at http://localhost:${port}`);

    // Start interactive CLI
    runInteractiveCli(storageDir, registry, () => server.stop()).catch(
      (error) => {
        console.error("CLI error:", error);
        server.stop();
        process.exit(1);
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    console.error("Run with --help for usage information.");
    process.exit(1);
  }
}

// Auto-run if this is the main module
if (import.meta.main) {
  await runCli();
}

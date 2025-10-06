/**
 * Development entry point for OpenTUI version
 * Run with: bun run src/tui-v2/dev.ts
 *
 * This mimics the real app's setup to test the OpenTUI implementation
 */

import { serve } from "@hono/node-server";
import { startHealthChecks } from "../health.js";
import { createApp } from "../server.js";
import { getStorageRoot, loadRegistry } from "../storage.js";
import type { Context } from "../tui/state.js";
import { runOpenTUI } from "./App.js";

async function main() {
  // Get storage directory (same as real app)
  const storageDir = getStorageRoot();

  // Load registry
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

  // Create context (same as real app)
  const context: Context = {
    storageDir,
    onExit: () => {
      console.log("Running cleanup...");
      stopHealthChecks();
      server.close();
    },
  };

  // Start OpenTUI version
  await runOpenTUI(context, registry);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

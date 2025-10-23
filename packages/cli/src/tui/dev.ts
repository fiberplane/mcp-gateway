/**
 * Development entry point for OpenTUI version
 * Run with: bun run --watch src/tui/dev.ts
 *
 * This simply runs cli.ts which has the full CLI implementation
 */

import { runCli } from "../cli.js";

runCli().catch(() => {
  process.exit(1);
});

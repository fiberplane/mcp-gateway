/**
 * Development entry point for OpenTUI version
 * Run with: bun run --watch src/tui-v2/dev.ts
 *
 * This simply runs run-v2.ts which has the full CLI implementation
 */

import { runCli } from "../run-v2.js";

runCli().catch((_error) => {
  process.exit(1);
});

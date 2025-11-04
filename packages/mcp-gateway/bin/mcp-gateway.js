#!/usr/bin/env node

// Lightweight shim so the compiled TypeScript CLI can be executed by Node.js
(async () => {
  const { runCli } = await import("../dist/cli.js");
  await runCli();
})();

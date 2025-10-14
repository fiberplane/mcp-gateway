import { $ } from "bun";
import { existsSync } from "node:fs";

await $`rm -rf dist`;

// Determine entrypoints based on what exists
const possibleEntrypoints = [
  "./src/index.ts",    // Most packages
  "./src/cli.ts",      // CLI package
];

const entrypoints = possibleEntrypoints.filter((entry) => existsSync(entry));

if (entrypoints.length === 0) {
  console.error("No entrypoints found!");
  process.exit(1);
}

// Build JavaScript with Bun
await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints,
  sourcemap: "inline",
  target: "node",
});

// Generate TypeScript declaration files for publishing
// Only if this package has a src/index.ts (library packages, not CLI)
// Use skipLibCheck to avoid needing built dependencies
if (existsSync("./src/index.ts")) {
  await $`bunx tsc --emitDeclarationOnly --declaration --skipLibCheck`;
}

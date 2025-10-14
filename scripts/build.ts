import { $ } from "bun";
import { existsSync } from "node:fs";

await $`rm -rf dist`;

// Determine entrypoints based on what exists
const possibleEntrypoints = [
  "./src/index.ts",    // Most packages
  "./src/run-v2.ts",   // CLI package
];

const entrypoints = possibleEntrypoints.filter((entry) => existsSync(entry));

if (entrypoints.length === 0) {
  console.error("No entrypoints found!");
  process.exit(1);
}

await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints,
  sourcemap: "inline",
  target: "node",
});

import { existsSync } from "node:fs";
import { $ } from "bun";

await $`rm -rf dist`;

// Determine entrypoints based on what exists
const possibleEntrypoints = [
  "./src/index.ts", // Most packages
  "./src/cli.ts", // CLI package
];

const entrypoints = possibleEntrypoints.filter((entry) => existsSync(entry));

if (entrypoints.length === 0) {
  console.error("No entrypoints found!");
  process.exit(1);
}

// Auto-detect external dependencies from package.json
// This ensures npm packages are resolved at runtime, not bundled
const pkg = JSON.parse(await Bun.file("./package.json").text());
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.optionalDependencies || {}),
];

// Build JavaScript with Bun
await Bun.build({
  format: "esm",
  outdir: "dist",
  root: "src",
  entrypoints,
  sourcemap: "inline",
  target: "node",
  external, // Auto-generated from package.json
});

// Generate TypeScript declaration files for publishing
// Only if this package has a src/index.ts (library packages, not CLI)
// Use skipLibCheck to avoid needing built dependencies
if (existsSync("./src/index.ts")) {
  await $`bunx tsc --emitDeclarationOnly --declaration --skipLibCheck`;
}

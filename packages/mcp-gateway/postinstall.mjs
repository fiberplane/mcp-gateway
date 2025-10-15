#!/usr/bin/env node
/**
 * Postinstall script for @fiberplane/mcp-gateway
 *
 * The bin/mcp-gateway wrapper handles finding and executing the binary,
 * so this postinstall just validates the installation in workspace context.
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if we're in a monorepo workspace (binaries not built yet during development)
let currentDir = __dirname;
let isWorkspace = false;

// Walk up the directory tree looking for workspace markers
for (let i = 0; i < 5; i++) {
  const parentDir = dirname(currentDir);
  if (parentDir === currentDir) break; // Reached filesystem root

  // Check for workspace markers
  const hasWorkspaceMarker =
    existsSync(join(parentDir, "bun.lock")) ||
    existsSync(join(parentDir, "bun.lockb")) ||
    existsSync(join(parentDir, "pnpm-workspace.yaml")) ||
    existsSync(join(parentDir, "lerna.json"));

  if (hasWorkspaceMarker && existsSync(join(parentDir, "packages"))) {
    isWorkspace = true;
    break;
  }

  currentDir = parentDir;
}

if (isWorkspace) {
  console.log(`[SKIP] Skipping binary setup in workspace context (binaries not built yet)`);
  process.exit(0);
}

// In published package, the bin/mcp-gateway wrapper handles everything
console.log(`[SUCCESS] MCP Gateway installed successfully`);

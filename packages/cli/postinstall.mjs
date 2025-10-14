#!/usr/bin/env node
/**
 * Postinstall script for @fiberplane/mcp-gateway
 *
 * This script detects the current platform and creates a symlink
 * to the appropriate platform-specific binary package.
 */

import { existsSync, mkdirSync, symlinkSync, unlinkSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect platform
const platform = process.platform;
const arch = process.arch;

// Map to platform package names
const platformMap = {
  "darwin-arm64": "@fiberplane/mcp-gateway-darwin-arm64",
  "darwin-x64": "@fiberplane/mcp-gateway-darwin-x64",
  "linux-x64": "@fiberplane/mcp-gateway-linux-x64",
  "win32-x64": "@fiberplane/mcp-gateway-windows-x64",
};

const platformKey = `${platform}-${arch}`;
const platformPackage = platformMap[platformKey];

if (!platformPackage) {
  console.error(`❌ Unsupported platform: ${platform}-${arch}`);
  console.error(`Supported platforms: ${Object.keys(platformMap).join(", ")}`);
  process.exit(1);
}

// Find the binary in node_modules (check multiple locations due to hoisting)
const binaryExt = platform === "win32" ? ".exe" : "";
const binaryName = `mcp-gateway${binaryExt}`;

// Possible locations for the binary package:
// 1. In our own node_modules (when not hoisted)
// 2. In parent node_modules (when hoisted - most common)
// 3. Two levels up (when globally installed)
const possiblePaths = [
  join(__dirname, "node_modules", platformPackage, binaryName),
  join(__dirname, "..", platformPackage, binaryName),
  join(__dirname, "..", "..", platformPackage, binaryName),
];

let binaryPath = null;
for (const path of possiblePaths) {
  if (existsSync(path)) {
    binaryPath = path;
    break;
  }
}

if (!binaryPath) {
  // In CI or during builds, binaries might not exist yet - exit gracefully
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    console.log(`⏭️  Skipping binary setup in CI environment (binaries not yet built)`);
    process.exit(0);
  }

  console.error(`❌ Binary not found for ${platform}-${arch}`);
  console.error(`Searched in:`);
  for (const path of possiblePaths) {
    console.error(`  - ${path}`);
  }
  console.error(
    `\nThis may happen if optional dependencies were skipped during installation.`
  );
  console.error(
    `Try reinstalling with: npm install --include=optional`
  );
  process.exit(1);
}

// Create bin directory if it doesn't exist
const binDir = join(__dirname, "bin");
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

// Create symlink to the binary
const linkPath = join(binDir, `mcp-gateway${binaryExt}`);

// Remove existing symlink/file if present
if (existsSync(linkPath)) {
  unlinkSync(linkPath);
}

try {
  symlinkSync(binaryPath, linkPath);
  // Make sure the binary is executable (Unix only)
  if (platform !== "win32") {
    chmodSync(binaryPath, 0o755);
  }
  console.log(`✓ MCP Gateway installed successfully for ${platform}-${arch}`);
} catch (error) {
  console.error(`❌ Failed to create symlink: ${error.message}`);
  process.exit(1);
}

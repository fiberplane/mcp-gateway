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
};

const platformKey = `${platform}-${arch}`;
const platformPackage = platformMap[platformKey];

if (!platformPackage) {
  console.error(`❌ Unsupported platform: ${platform}-${arch}`);
  console.error(`Supported platforms: ${Object.keys(platformMap).join(", ")}`);
  process.exit(1);
}

// Find the binary in node_modules
const binaryPath = join(
  __dirname,
  "node_modules",
  platformPackage,
  "mcp-gateway"
);

if (!existsSync(binaryPath)) {
  console.error(`❌ Binary not found at ${binaryPath}`);
  console.error(
    `This may happen if optional dependencies were skipped during installation.`
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
const linkPath = join(binDir, "mcp-gateway");

// Remove existing symlink if present
if (existsSync(linkPath)) {
  unlinkSync(linkPath);
}

try {
  symlinkSync(binaryPath, linkPath);
  // Make sure the binary is executable
  chmodSync(binaryPath, 0o755);
  console.log(`✓ MCP Gateway installed successfully for ${platform}-${arch}`);
} catch (error) {
  console.error(`❌ Failed to create symlink: ${error.message}`);
  process.exit(1);
}

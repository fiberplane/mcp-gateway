#!/usr/bin/env node
/**
 * Postinstall script for @fiberplane/mcp-gateway
 *
 * This script detects the current platform and creates a symlink
 * to the appropriate platform-specific binary package.
 */

import { existsSync, mkdirSync, symlinkSync, copyFileSync, unlinkSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Enable debug logging on Windows or when DEBUG=1
const DEBUG = process.platform === "win32" || process.env.DEBUG === "1";
function debug(...args) {
  if (DEBUG) {
    console.log("[postinstall DEBUG]", ...args);
  }
}

debug("Starting postinstall script");
debug("__dirname:", __dirname);
debug("Platform:", process.platform, "Arch:", process.arch);

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

debug("Looking for binary:", binaryName);
debug("Platform package:", platformPackage);

// Possible locations for the binary package:
// 1. In our own node_modules (when not hoisted)
// 2. In parent node_modules (when hoisted - most common)
// 3. Two levels up (when globally installed)
const possiblePaths = [
  join(__dirname, "node_modules", platformPackage, binaryName),
  join(__dirname, "..", platformPackage, binaryName),
  join(__dirname, "..", "..", platformPackage, binaryName),
];

debug("Checking paths:", possiblePaths);

let binaryPath = null;
for (const path of possiblePaths) {
  debug("Checking:", path, "exists:", existsSync(path));
  if (existsSync(path)) {
    binaryPath = path;
    debug("Found binary at:", binaryPath);
    break;
  }
}

if (!binaryPath) {
  debug("Binary not found, checking if in workspace context");

  // Check if we're in a monorepo workspace by looking for workspace root markers
  // This handles the case where binaries haven't been built yet during CI/dev
  let currentDir = __dirname;
  let isWorkspace = false;

  // Walk up the directory tree looking for workspace markers
  for (let i = 0; i < 5; i++) {
    const parentDir = dirname(currentDir);
    debug(`Checking parent dir (level ${i}):`, parentDir);
    if (parentDir === currentDir) {
      debug("Reached filesystem root");
      break; // Reached filesystem root
    }

    // Check for bun.lock/bun.lockb (Bun workspace) or pnpm-workspace.yaml or lerna.json
    const markers = {
      "bun.lock": existsSync(join(parentDir, "bun.lock")),
      "bun.lockb": existsSync(join(parentDir, "bun.lockb")),
      "pnpm-workspace.yaml": existsSync(join(parentDir, "pnpm-workspace.yaml")),
      "lerna.json": existsSync(join(parentDir, "lerna.json")),
    };
    debug("Workspace markers:", markers);

    const hasWorkspaceMarker = Object.values(markers).some(exists => exists);

    if (hasWorkspaceMarker) {
      // Also verify this looks like our monorepo by checking for packages dir
      const hasPackagesDir = existsSync(join(parentDir, "packages"));
      debug("Has packages dir:", hasPackagesDir);
      if (hasPackagesDir) {
        isWorkspace = true;
        debug("Detected workspace at:", parentDir);
        break;
      }
    }

    currentDir = parentDir;
  }

  if (isWorkspace) {
    console.log(`⏭️  Skipping binary setup in workspace context (binaries not built yet)`);
    process.exit(0);
  }

  debug("Not in workspace, proceeding with error");

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
debug("Binary directory:", binDir);
if (!existsSync(binDir)) {
  debug("Creating bin directory");
  mkdirSync(binDir, { recursive: true });
}

// Create symlink (Unix) or copy (Windows) to the binary
const linkPath = join(binDir, `mcp-gateway${binaryExt}`);
debug("Link/copy target:", linkPath);

// Remove existing symlink/file if present
if (existsSync(linkPath)) {
  debug("Removing existing file at:", linkPath);
  unlinkSync(linkPath);
}

try {
  if (platform === "win32") {
    // Windows: Copy the binary instead of symlinking (doesn't require admin/dev mode)
    debug("Copying binary (Windows):", binaryPath, "->", linkPath);
    copyFileSync(binaryPath, linkPath);
    debug("Copy successful");
  } else {
    // Unix: Create symlink
    debug("Creating symlink (Unix):", binaryPath, "->", linkPath);
    symlinkSync(binaryPath, linkPath);
    // Make sure the binary is executable
    chmodSync(binaryPath, 0o755);
    debug("Symlink successful");
  }
  console.log(`✓ MCP Gateway installed successfully for ${platform}-${arch}`);
} catch (error) {
  console.error(`❌ Failed to setup binary: ${error.message}`);
  debug("Error stack:", error.stack);
  process.exit(1);
}

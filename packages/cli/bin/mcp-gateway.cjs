#!/usr/bin/env node

// Wrapper that executes the platform-specific binary
// This allows bunx/npx to work without running postinstall first
// Follows the pattern used by Biome and other binary-distribution packages

const { spawnSync } = require('child_process');

// Detect platform
const platform = process.platform;
const arch = process.arch;

// Map to platform package binary paths
const PLATFORMS = {
  'darwin-arm64': '@fiberplane/mcp-gateway-darwin-arm64/mcp-gateway',
  'darwin-x64': '@fiberplane/mcp-gateway-darwin-x64/mcp-gateway',
  'linux-x64': '@fiberplane/mcp-gateway-linux-x64/mcp-gateway',
  'win32-x64': '@fiberplane/mcp-gateway-windows-x64/mcp-gateway.exe',
};

const platformKey = `${platform}-${arch}`;
const binaryPath = PLATFORMS[platformKey];

if (!binaryPath) {
  if (platform === 'win32') {
    console.error('[ERROR] Windows support is temporarily unavailable in version 0.4.0+');
    console.error('');
    console.error('Use version 0.3.x: npm install -g @fiberplane/mcp-gateway@0.3');
    console.error('');
    process.exit(1);
  }

  console.error(`[ERROR] Unsupported platform: ${platform}-${arch}`);
  console.error(`Supported platforms: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(1);
}

// Use require.resolve to find the binary (handles all node_modules resolution patterns)
let resolvedPath;
try {
  resolvedPath = require.resolve(binaryPath);
} catch (error) {
  console.error(`[ERROR] Binary not found for ${platform}-${arch}`);
  console.error('');
  console.error('The platform-specific binary package may not be installed.');
  console.error(`Expected package: ${binaryPath.split('/')[0]}`);
  console.error('');
  console.error('This usually means optional dependencies were not installed.');
  console.error('Try: npm install -g @fiberplane/mcp-gateway@next');
  console.error('');
  process.exit(1);
}

// Ensure the binary is executable (npm strips execute permissions from tarballs)
if (platform !== 'win32') {
  const { chmodSync } = require('fs');
  try {
    chmodSync(resolvedPath, 0o755);
  } catch (error) {
    // Ignore chmod errors - may not have permission
  }
}

// Execute the binary with all arguments
const result = spawnSync(resolvedPath, process.argv.slice(2), {
  stdio: 'inherit',
  shell: false,
  windowsHide: true,
});

if (result.error) {
  console.error('[ERROR] Failed to execute binary');
  console.error('');
  console.error(result.error.message);
  console.error('');
  process.exit(1);
}

process.exitCode = result.status;

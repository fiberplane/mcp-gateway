#!/usr/bin/env node

// Wrapper that executes the platform-specific binary
// This allows bunx/npx to work without running postinstall first

const { execFileSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');
const path = require('path');

// Detect platform
const platform = process.platform;
const arch = process.arch;

// Map to platform package names
const platformPackages = {
  'darwin-arm64': '@fiberplane/mcp-gateway-darwin-arm64',
  'linux-x64': '@fiberplane/mcp-gateway-linux-x64',
};

const platformKey = `${platform}-${arch}`;
const platformPackage = platformPackages[platformKey];

if (!platformPackage) {
  if (platform === 'win32') {
    console.error('[ERROR] Windows support is temporarily unavailable in version 0.4.0+');
    console.error('');
    console.error('Use version 0.3.x: npm install -g @fiberplane/mcp-gateway@0.3');
    console.error('');
    process.exit(1);
  }

  console.error(`[ERROR] Unsupported platform: ${platform}-${arch}`);
  console.error(`Supported platforms: ${Object.keys(platformPackages).join(', ')}`);
  process.exit(1);
}

// Find the binary (check multiple possible locations)
const binaryName = platform === 'win32' ? 'mcp-gateway.exe' : 'mcp-gateway';

// Extract package directory name (without scope) for workspace paths
const platformDir = platformPackage.replace('@fiberplane/', '');

const possiblePaths = [
  // When installed via npm/bunx - in node_modules
  path.join(__dirname, '..', 'node_modules', platformPackage, binaryName),
  // When in workspace/monorepo - sibling packages directory
  path.join(__dirname, '..', '..', platformDir, binaryName),
  // When installed globally - platform package hoisted to parent
  path.join(__dirname, '..', '..', platformPackage, binaryName),
  // Alternative hoisting pattern
  path.join(__dirname, '..', '..', '..', platformPackage, binaryName),
];

let binaryPath = null;
for (const testPath of possiblePaths) {
  if (existsSync(testPath)) {
    binaryPath = testPath;
    break;
  }
}

if (!binaryPath) {
  console.error(`[ERROR] Binary not found for ${platform}-${arch}`);
  console.error('');
  console.error('The platform-specific binary package may not be installed.');
  console.error('Try reinstalling: npm install --force');
  console.error('');
  process.exit(1);
}

// Execute the binary with all arguments
try {
  execFileSync(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    windowsHide: true,
  });
} catch (error) {
  process.exit(error.status || 1);
}

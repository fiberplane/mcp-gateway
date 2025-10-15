# Binary-Only Distribution

MCP Gateway is distributed as compiled Bun binaries via npm, not as source code.

## Published Packages

Only the following packages are published to npm:

- **`@fiberplane/mcp-gateway`** - Main wrapper package with platform detection
- **`@fiberplane/mcp-gateway-linux-x64`** - Linux x64 binary
- **`@fiberplane/mcp-gateway-darwin-arm64`** - macOS ARM64 (Apple Silicon) binary

## Private Internal Packages

The following packages are built internally but NOT published to npm:

- **`@fiberplane/mcp-gateway-cli`** - CLI source code (private)
- **`@fiberplane/mcp-gateway-types`** - Type definitions (private)
- **`@fiberplane/mcp-gateway-core`** - Core functionality (private)
- **`@fiberplane/mcp-gateway-server`** - HTTP server (private)

These packages are marked as `"private": true` and ignored by Changesets.

## Why Binary Distribution?

The CLI uses OpenTUI which has `bun:ffi` dependencies that cannot be distributed via npm as source code:
- `bunx @fiberplane/mcp-gateway` fails with FFI errors when running from npm
- Even Bun cannot execute the package from npm - it requires local installation
- The only viable solution is to distribute pre-compiled binaries

## How It Works

1. **Development**: Use `bun run dev` to run CLI from source
2. **CI Build**: GitHub Actions builds binaries for each platform in parallel
3. **Platform Detection**: `postinstall.mjs` detects platform and creates symlink to appropriate binary
4. **Installation**: `npm install -g @fiberplane/mcp-gateway` installs wrapper + platform binary

## Supported Platforms

- ✅ Linux x64 (linux-x64)
- ✅ macOS ARM64 (darwin-arm64) - Apple Silicon

## Adding New Platforms

To add support for additional platforms (e.g., darwin-x64, windows-x64):

1. Update `.github/workflows/release.yml` build matrix:
   ```yaml
   matrix:
     include:
       - platform: linux-x64
         os: ubuntu-latest
       - platform: darwin-arm64
         os: macos-latest
       - platform: darwin-x64  # Add new platform
         os: macos-13          # Intel Mac runner
   ```

2. Update `packages/mcp-gateway/package.json` optionalDependencies:
   ```json
   "optionalDependencies": {
     "@fiberplane/mcp-gateway-darwin-arm64": "workspace:*",
     "@fiberplane/mcp-gateway-darwin-x64": "workspace:*",  // Add new platform
     "@fiberplane/mcp-gateway-linux-x64": "workspace:*"
   }
   ```

3. Create platform package directory: `packages/mcp-gateway-darwin-x64/`
4. Update `packages/mcp-gateway/postinstall.mjs` to handle the new platform

## Changesets Configuration

Changesets ignores internal packages to reduce noise:

```json
{
  "ignore": [
    "test-mcp-server",
    "@fiberplane/mcp-gateway-types",
    "@fiberplane/mcp-gateway-core",
    "@fiberplane/mcp-gateway-server"
  ]
}
```

Only changes to the wrapper and binary packages require changesets.

## Publishing

The CI publish script (`scripts/ci-publish.ts`) automatically:
- Skips packages marked as `"private": true`
- Publishes wrapper + platform binaries
- Handles both normal releases and snapshot releases (with `--tag next`)


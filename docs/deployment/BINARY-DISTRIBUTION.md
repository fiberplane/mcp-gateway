# Package Distribution

MCP Gateway is distributed via npm as a standard Node.js package.

## Published Package

The main package published to npm:

- **`@fiberplane/mcp-gateway`** - Main CLI package

## Private Internal Packages

The following packages are built internally but NOT published to npm:

- **`@fiberplane/mcp-gateway-types`** - Type definitions (private)
- **`@fiberplane/mcp-gateway-core`** - Core functionality (private)
- **`@fiberplane/mcp-gateway-api`** - REST API (private)
- **`@fiberplane/mcp-gateway-server`** - HTTP server (private)
- **`@fiberplane/mcp-gateway-web`** - Web UI (private)

These packages are marked as `"private": true` and ignored by Changesets.

## How It Works

1. **Development**: Use `bun run dev` to run CLI from source
2. **Build**: `bun run build` compiles TypeScript to JavaScript
3. **Installation**: `npm install -g @fiberplane/mcp-gateway` installs the CLI globally

## Changesets Configuration

Changesets ignores internal packages to reduce noise:

```json
{
  "ignore": [
    "test-mcp-server",
    "@fiberplane/mcp-gateway-types",
    "@fiberplane/mcp-gateway-core",
    "@fiberplane/mcp-gateway-api",
    "@fiberplane/mcp-gateway-server",
    "@fiberplane/mcp-gateway-web"
  ]
}
```

Only changes to the main package require changesets.

## Publishing

The CI publish script automatically:
- Skips packages marked as `"private": true`
- Publishes the main CLI package
- Handles both normal releases and snapshot releases (with `--tag next`)

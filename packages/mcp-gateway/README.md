# @fiberplane/mcp-gateway-cli

Private package containing the CLI source code for MCP Gateway. This package orchestrates the server, API, and TUI components.

> **Note**: This is the private source package. The public wrapper package is `@fiberplane/mcp-gateway` which handles platform-specific binary distribution.

## Overview

This package contains:
- **CLI Entry Point** (`src/cli.ts`) - Command-line interface and argument parsing
- **TUI** (`src/tui/`) - Terminal user interface using OpenTUI
- **Binary Entry** (`src/binary-entry.ts`) - Compiled binary entry point
- **Orchestration** - Coordinates server, API, and storage packages

The CLI provides both a terminal UI for interactive server management and serves a web UI for browsing captured logs.

## Prerequisites

- **Bun** 1.0+ - Primary runtime and package manager
- **Node.js** 18+ - For compatibility checks
- Familiarity with Bun workspace commands

## Quick Start

### Option 1: Simple Development (Pre-built Web UI)

If you only need to work on the CLI/TUI and don't need web UI hot reload:

```bash
# 1. Build web UI first (one-time or when web changes)
bun run --filter @fiberplane/mcp-gateway-web build

# 2. Run CLI in dev mode
bun run --filter @fiberplane/mcp-gateway-cli dev
```

This serves the pre-built web UI at `http://localhost:3333/ui`.

### Option 2: Full Development (Vite HMR)

If you need web UI hot reload during development:

```bash
# Terminal 1: Run CLI
bun run --filter @fiberplane/mcp-gateway-cli dev

# Terminal 2: Run web UI dev server
bun run --filter @fiberplane/mcp-gateway-web dev
```

- CLI runs on port 3333 (API + TUI)
- Vite dev server on port 5173 (Web UI with HMR)
- Access web UI at `http://localhost:5173`
- API calls proxied to `http://localhost:3333/api`

## File Structure

```
packages/mcp-gateway/
├── src/
│   ├── cli.ts              # CLI entry point and arg parsing
│   ├── binary-entry.ts     # Compiled binary entry point
│   ├── tui/                # Terminal UI components
│   │   ├── activity-log.ts
│   │   ├── command-menu.ts
│   │   ├── help-view.ts
│   │   ├── server-management.ts
│   │   └── ...
│   └── events.ts           # TUI event system
├── bin/                    # Development executable symlink
├── dist/                   # Built files (gitignored)
├── public/                 # Web UI static files (copied from web package)
├── tests/                  # Integration tests
├── package.json
└── tsconfig.json
```

## CLI Features

### Command Options

```bash
# Start with custom port
bun run dev -- --port 8080

# Custom storage directory
bun run dev -- --storage-dir /custom/path

# Run in headless mode without TUI
bun run dev -- --no-tui

# Show help
bun run dev -- --help

# Show version
bun run dev -- --version
```

The `--no-tui` flag is useful when:
- Running in Docker containers with TTY allocated but headless mode desired
- Running as a systemd service
- Testing or CI/CD environments
- Running multiple instances where you want to manage via API/Web UI only

### TUI Keyboard Shortcuts

- `/` - Open command menu
- `q` - Quit application
- `ESC` - Go back / Close modal
- `v` - View Activity Log
- `m` - Manage Servers
- `a` - Add New Server
- `c` - Clear Activity Logs
- `h` - Help & Setup Guide

## Web UI Integration

The CLI serves the web UI at `/ui` endpoint. There are two ways to handle this in development:

### How the postbuild Script Works

The `postbuild` script in `package.json`:

```json
"postbuild": "bun run --filter @fiberplane/mcp-gateway-web build && cp -r ../web/public ./public"
```

This:
1. Builds the web UI package (`@fiberplane/mcp-gateway-web`)
2. Copies the output from `packages/web/public/` to `packages/cli/public/`
3. The CLI then serves these files at `/ui`

### Development Workflows

**Pre-built Mode** (Option 1):
- Run web build once
- Web UI files copied to `packages/cli/public/`
- CLI serves static files at `http://localhost:3333/ui`
- No hot reload for web changes

**Dev Server Mode** (Option 2):
- Run Vite dev server separately
- Access at `http://localhost:5173`
- Vite proxies `/api` calls to CLI on port 3333
- Full hot module replacement

## Building

### Build CLI Package

```bash
# From monorepo root
bun run build

# Or explicitly
bun run --filter @fiberplane/mcp-gateway-cli build
```

This:
1. Compiles TypeScript to JavaScript
2. Runs `postbuild` script (builds web UI, copies files)
3. Outputs to `dist/` directory

### Build Platform Binaries

```bash
# Build for current platform only
bun run build:binaries

# Build for all platforms (requires GitHub Actions)
bun run build:binaries --all
```

This creates platform-specific binaries:
- `@fiberplane/mcp-gateway-darwin-arm64`
- `@fiberplane/mcp-gateway-darwin-x64`
- `@fiberplane/mcp-gateway-linux-x64`
- `@fiberplane/mcp-gateway-windows-x64`

### Build Everything

```bash
# Build all packages in dependency order
bun run build

# Build binaries
bun run build:binaries
```

## Testing

### Run Tests

```bash
# All tests
bun test

# CLI package only
bun run --filter @fiberplane/mcp-gateway-cli test
```

### Test MCP Server

Use the test MCP server to validate proxy functionality:

```bash
# Terminal 1: Run test MCP server
bun run --filter test-mcp-server dev

# Terminal 2: Run CLI
bun run dev
```

Then add the test server in the TUI:
- Name: `test-server`
- URL: `http://localhost:3000/mcp`

## Common Tasks

### Adding Dependencies

```bash
cd packages/mcp-gateway
bun add <package-name>
```

### Type Checking

```bash
# All packages
bun run typecheck

# CLI only
bun run --filter @fiberplane/mcp-gateway-cli typecheck
```

### Linting & Formatting

```bash
# From monorepo root
bun run lint
bun run format
```

## Troubleshooting

### Issue: `public/` Folder Missing

**Symptom:** Web UI shows 404 at `http://localhost:3333/ui`

**Solution:**
```bash
# Build web UI
bun run --filter @fiberplane/mcp-gateway-web build

# Copy to CLI package
cp -r packages/web/public packages/cli/public

# Or run postbuild script
cd packages/cli
bun run postbuild
```

### Issue: Port 3333 Already in Use

**Symptom:** Error: "EADDRINUSE: address already in use :::3333"

**Solution:**
```bash
# Find process using port 3333
lsof -i :3333

# Kill the process
kill -9 <PID>

# Or use a different port
bun run dev -- --port 8080
```

### Issue: TUI Display Issues

**Symptom:** Garbled text, overlapping elements

**Solution:**
- Ensure terminal supports ANSI escape codes
- Try resizing terminal window
- Check terminal emulator compatibility (iTerm2, Alacritty recommended)

### Issue: Web UI Shows Stale Data

**Symptom:** Web UI doesn't reflect recent changes

**Solution:**
```bash
# Hard refresh in browser (Cmd+Shift+R or Ctrl+Shift+R)

# Or rebuild web UI
bun run --filter @fiberplane/mcp-gateway-web build
cp -r packages/web/public packages/cli/public
```

### Issue: Cannot Connect to MCP Servers

**Symptom:** "Failed to connect to server" errors in TUI

**Solution:**
1. Check server URL is correct
2. Verify server is running (`curl <server-url>`)
3. Check server logs for errors
4. Ensure no CORS issues (HTTP MCP servers)

## Package Dependencies

### Direct Dependencies

- `@fiberplane/mcp-gateway-api` - REST API for querying logs
- `@fiberplane/mcp-gateway-core` - Core business logic
- `@fiberplane/mcp-gateway-server` - HTTP server with proxy
- `@fiberplane/mcp-gateway-types` - Type definitions
- `@fiberplane/mcp-gateway-web` - Web UI (dev dependency, bundled in production)
- `@hono/node-server` - Node.js adapter for Hono
- `hono` - Web framework
- `open-tui` - Terminal UI framework
- `zod` - Schema validation

### Dev Dependencies

Managed at monorepo root level.

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Complete monorepo development guide
- [packages/web/README.md](../web/README.md) - Web UI package documentation
- [packages/api/README.md](../api/README.md) - API package documentation
- [packages/server/README.md](../server/README.md) - Server package documentation

## Development Workflow

1. **Make changes** in `src/` directory
2. **Run in dev mode** (choose Option 1 or 2 above)
3. **Test changes** manually or with automated tests
4. **Type check** with `bun run typecheck`
5. **Lint** with `bun run lint`
6. **Format** with `bun run format`
7. **Commit** with conventional commit message
8. **Create changeset** if this is a release-worthy change

## Debugging

### Enable Debug Logging

```bash
# Set log level
DEBUG=* bun run dev

# Or in code
logger.debug("Debug message", { context: "value" });
```

### Inspect Storage

```bash
# View registry
cat ~/.mcp-gateway/mcp.json

# View captures
ls -la ~/.mcp-gateway/captures/

# View logs for specific server
cat ~/.mcp-gateway/captures/my-server/*.jsonl
```

## Contributing

When contributing to the CLI package:

1. **Follow monorepo patterns** - Use workspace dependencies
2. **Maintain backwards compatibility** - CLI is a public API
3. **Test with real MCP servers** - Not just test servers
4. **Document new features** - Update README and CLAUDE.md
5. **Add tests** - For new CLI options or TUI features

## License

MIT

# @fiberplane/mcp-gateway-cli

**Private package** - This is the source code for the MCP Gateway CLI and Terminal UI (TUI). The public package `@fiberplane/mcp-gateway` distributes this as pre-compiled binaries.

## Overview

This package contains:

- **CLI entry point** (`src/cli.ts`) - Command-line argument parsing and initialization
- **Terminal UI (TUI)** (`src/tui/`) - Interactive interface for managing MCP servers
- **Web UI static server** - Serves React-based web UI at `/ui` endpoint
- **MCP server orchestration** - Manages and routes requests to multiple MCP servers

The CLI is part of a monorepo. During development, you'll run the TypeScript source directly. When building for distribution, it's compiled to a single executable binary.

## Quick Start

### Development Mode (Simple)

Build the web UI once, then run CLI:

```bash
# From monorepo root
bun install

# Build web UI once
bun run --filter @fiberplane/mcp-gateway-web build

# Run CLI in dev mode
bun run --filter @fiberplane/mcp-gateway-cli dev
```

**What happens:**
- CLI runs on `http://localhost:3333`
- Web UI served at `http://localhost:3333/ui` from pre-built output
- TUI displays in terminal
- No hot reload for web UI changes

### Development Mode (Full HMR)

Run CLI and web dev server with hot module replacement:

```bash
# Terminal 1: Run CLI
bun run --filter @fiberplane/mcp-gateway-cli dev

# Terminal 2: Run web dev server
bun run --filter @fiberplane/mcp-gateway-web dev
```

**What happens:**
- CLI runs on `http://localhost:3333`
- Web dev server runs on `http://localhost:5173`
- Vite proxies `/api/*` requests to `http://localhost:3333`
- Web UI updates with hot module replacement when you edit files
- TUI displays in Terminal 1

## CLI Options

The CLI accepts the following command-line options:

```bash
# Custom port
bun run --filter @fiberplane/mcp-gateway-cli dev -- --port 8080

# Custom storage directory
bun run --filter @fiberplane/mcp-gateway-cli dev -- --storage-dir /custom/path

# Run in headless mode (no TUI)
bun run --filter @fiberplane/mcp-gateway-cli dev -- --no-tui

# Show help
bun run --filter @fiberplane/mcp-gateway-cli dev -- --help

# Show version
bun run --filter @fiberplane/mcp-gateway-cli dev -- --version
```

### --no-tui Flag

The `--no-tui` flag disables the terminal UI and runs the gateway in headless mode. This is useful for:

- **Docker containers** - When TTY is allocated but you want headless operation
- **systemd services** - Running as a background service
- **CI/CD environments** - Automated testing and deployment
- **Multiple instances** - Managing via API/Web UI only

The CLI automatically detects when no TTY is available and runs in headless mode. The `--no-tui` flag explicitly forces headless mode even when a TTY is available.

## File Structure

```
packages/cli/
├── src/
│   ├── cli.ts              # CLI entry point (argument parsing, initialization)
│   ├── binary-entry.ts     # Binary compilation entry point (for bun build --compile)
│   ├── events.ts           # TUI event system
│   ├── index.ts            # Public exports
│   ├── tui/                # Terminal UI components and screens
│   │   ├── components/     # Reusable TUI components
│   │   ├── screens/        # Full-screen views (Activity Log, Server Management, etc.)
│   │   └── index.tsx       # TUI app entry point
│   └── utils/              # Utilities (CLI parsing, formatting, etc.)
├── bin/
│   └── cli.js              # Entrypoint for npm bin command (calls src/cli.ts)
├── dist/                   # Compiled output (generated after build)
├── public/                 # Web UI static files (generated after build)
├── tests/                  # Integration tests
├── package.json            # Package config
├── vite.config.ts         # Build configuration (shared with workspace)
└── tsconfig.json          # TypeScript configuration
```

### Development

#### Option 1: Pre-built (Simple)

Web UI files are copied to `packages/cli/public/` during build. This happens automatically via the `postbuild` script:

```json
{
  "postbuild": "mkdir -p public && cp -r ../web/dist/* public/"
}
```

To update the web UI:
```bash
bun run --filter @fiberplane/mcp-gateway-web build
```

#### Option 2: Vite Dev Server (Full HMR)

For active web UI development with hot module replacement:

```bash
# Terminal 1: CLI server
bun run --filter @fiberplane/mcp-gateway-cli dev

# Terminal 2: Vite dev server
bun run --filter @fiberplane/mcp-gateway-web dev
```

Then visit `http://localhost:5173` - Vite automatically proxies API calls to the CLI server.

## Building

### Build CLI Package

Compiles TypeScript to JavaScript, runs tests, and copies web UI files:

```bash
bun run --filter @fiberplane/mcp-gateway-cli build
```

This:
1. Runs TypeScript compiler
2. Generates type declarations
3. Executes postbuild (builds web UI and copies to `public/`)
4. Creates `dist/` directory with compiled code


## Troubleshooting

### Issue: `public/` folder is missing

**Symptoms:** Web UI returns 404, or error about missing public directory

**Solution:**
```bash
# Build web UI to generate public/ folder
bun run --filter @fiberplane/mcp-gateway-web build

# Then run CLI
bun run --filter @fiberplane/mcp-gateway-cli dev
```

### Issue: Port 3333 is already in use

**Symptoms:** Error: "Address already in use"

**Solution:**
```bash
# Use different port
bun run --filter @fiberplane/mcp-gateway-cli dev -- --port 8080
```

### Issue: TUI not displaying correctly

**Symptoms:** Terminal UI appears garbled or incomplete

**Solution:**
- Ensure terminal is at least 80x24 characters
- Try resizing terminal window
- Set `LOG_LEVEL=debug` for debugging info:
  ```bash
  LOG_LEVEL=debug bun run --filter @fiberplane/mcp-gateway-cli dev
  ```

### Issue: Web UI shows stale data

**Symptoms:** Web UI doesn't update when you make requests

**Solution:**

If using pre-built mode, rebuild web UI:
```bash
bun run --filter @fiberplane/mcp-gateway-web build
```

If using Vite dev server, check console for errors and ensure API proxy is working.

### Issue: Cannot connect to MCP servers

**Symptoms:** "Server unreachable" in TUI or web UI

**Solution:**
1. Verify MCP server is running (e.g., test-mcp-server)
2. Check server URL is correct in configuration
3. View logs in Activity Log (press `/` then `v`)
4. Check API logs: `~/.mcp-gateway/logs/`


## Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Monorepo structure and development guidelines
- **[packages/web/README.md](../web/README.md)** - Web UI package documentation
- **[packages/server/README.md](../server/README.md)** - Proxy MCP server package documentation
- **[@fiberplane/mcp-gateway](../mcp-gateway/README.md)** - Public CLI package (binary wrapper)


## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug bun run --filter @fiberplane/mcp-gateway-cli dev
```

### Check Storage Directory

MCP Gateway stores configuration and logs in `~/.mcp-gateway/`:

```bash
ls -la ~/.mcp-gateway/
# Should contain:
# - mcp.json (configuration)
# - captures/ (directory with request/response logs)
# - logs/ (the run logs can be found here)
```

### View Traffic Logs

Captured MCP traffic is stored as JSONL:

```bash
cat ~/.mcp-gateway/captures/<server-name>/<session-id>.jsonl | jq .
```

## Contributing

When contributing to the CLI:

1. Follow the structure: TUI components in `src/tui/`, utilities in `src/utils/`
2. Keep CLI logic in `src/cli.ts` minimal
3. Test with both TUI and web UI
4. Run full check before submitting: `bun run lint && bun run typecheck && bun test`
5. See [CLAUDE.md](../../CLAUDE.md) for monorepo guidelines

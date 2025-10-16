# MCP Gateway

A local HTTP proxy for managing and debugging multiple Model Context Protocol (MCP) servers through a unified interface.

![MCP Gateway](./packages/mcp-gateway/assets/mcp-gateway.jpg)

## Quick Start

**Try it with npx:**
```bash
npx @fiberplane/mcp-gateway
```

**Install globally:**
```bash
npm install -g @fiberplane/mcp-gateway
mcp-gateway
```

Runs on port 3333 with an interactive TUI for server management. Configuration persists to `~/.mcp-gateway/mcp.json`.

> **Note**: MCP Gateway is distributed as pre-compiled binaries for optimal performance and compatibility. Supports macOS (Intel & Apple Silicon), Linux x64, and Windows x64.

## Adding MCP Servers

**Interactive (TUI):**
1. Press `/` to open the command menu
2. Select "Add New Server" or press `a`
3. Enter server name and URL
4. Server immediately available at `http://localhost:3333/servers/:serverName/mcp`

**Configuration file (`~/.mcp-gateway/mcp.json`):**

```json
{
  "mcpServers": {
    "weather": {
      "type": "http",
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  }
}
```

## TUI Navigation

### Global Shortcuts
- `/` - Open command menu (quick access to all commands)
- `q` - Quit application
- `ESC` - Go back / Close modal / Return to Activity Log

### Command Menu (press `/`)
- `v` - View Activity Log
- `m` - Manage Servers
- `a` - Add New Server
- `c` - Clear Activity Logs
- `h` - Help & Setup Guide

### Activity Log View
- `↑` / `↓` - Navigate log entries
- `Home` / `End` - Jump to first/last entry
- `Enter` - View log details
- Auto-follows new entries (press `↑` to pause)

### Server Management View
- `↑` / `↓` - Navigate servers
- `Enter` - View server configuration
- `d` - Delete selected server

## Features

**Request routing**: Route requests to different MCP servers by name (e.g., `/servers/weather/mcp`, `/servers/database/mcp`)

**Traffic capture**: All requests/responses logged to `~/.mcp-gateway/captures/:serverName/:sessionId.jsonl` with timing metrics and error states

**Health monitoring**: Periodic health checks with status indicators in TUI

**MCP tools**: Gateway exposes its own MCP server at `/gateway/mcp` with tools for server management (`add_server`, `remove_server`, `list_servers`) and traffic analysis (`search_records`)

**Short aliases**: For convenience, use `/s/:server/mcp` for servers and `/g/mcp` for gateway tools

## CLI Options

```bash
# Custom storage directory
mcp-gateway --storage-dir /custom/path

# Custom port (useful for running multiple instances)
mcp-gateway --port 8080

# Combine options
mcp-gateway --port 8080 --storage-dir /custom/path

# Show help
mcp-gateway --help

# Show version
mcp-gateway --version
```

**Available Options:**
- `--port <number>` - Port to run the gateway server on (default: 3333)
- `--storage-dir <path>` - Storage directory for registry and captures (default: ~/.mcp-gateway)
- `-h, --help` - Show help information
- `-v, --version` - Show version number

## Development

This project uses a monorepo structure with the CLI source in `@fiberplane/mcp-gateway-cli`. The `@fiberplane/mcp-gateway` functions as the entry point to run the right platform binary which bundles in the `@fiberplane/mcp-gateway-cli` package.

```bash
# In monorepo root
bun install

# Run in development mode
bun run dev

# Build CLI package
bun run build

# Build platform binaries
bun run build:binaries

# Run tests
bun run --filter @fiberplane/mcp-gateway-cli test
```

See [AGENTS.md](../../AGENTS.md) for complete development documentation.

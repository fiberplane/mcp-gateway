# MCP Gateway

A local HTTP proxy for managing and debugging multiple Model Context Protocol (MCP) servers through a unified interface.

![MCP Gateway](./assets/mcp-gateway.png)

## Quick Start

```bash
npx @fiberplane/mcp-gateway
```

Runs on port 3333 with an interactive TUI for server management. Configuration persists to `~/.mcp-gateway/mcp.json`.

## Adding MCP Servers

**Interactive (press `a` in TUI):**
- Enter server name, URL, and optional headers
- Server immediately available at `http://localhost:3333/:serverName/mcp`

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

## TUI Controls

- `a` - Add server
- `d` - Delete server
- `c` - Clear logs
- `m` - Show MCP client instructions
- `q` - Quit

## Features

**Request routing**: Route requests to different MCP servers by name (e.g., `/weather/mcp`, `/database/mcp`)

**Traffic capture**: All requests/responses logged to `~/.mcp-gateway/captures/:serverName/:sessionId.jsonl` with timing metrics and error states

**Health monitoring**: Periodic health checks with status indicators in TUI

**MCP tools**: Gateway exposes its own MCP server at `/mcp` with tools for server management (`add_server`, `remove_server`, `list_servers`) and traffic analysis (`search_records`)

## CLI Options

```bash
mcp-gateway --storage-dir /custom/path
```

## Development

```bash
# In monorepo root
bun install
bun run --filter @fiberplane/mcp-gateway build
bun run --filter @fiberplane/mcp-gateway test
```
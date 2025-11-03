# MCP Gateway

**A unified gateway for managing and monitoring MCP (Model Context Protocol) servers in production.**

MCP Gateway provides a centralized platform for discovering, routing, and logging all MCP protocol traffic. Use it to manage multiple MCP servers, capture detailed interaction logs, and troubleshoot integration issues with Claude and other AI clients.

## Features

- **Server Management** - Add, remove, and monitor MCP servers from a single dashboard
- **Traffic Capture** - Automatic logging of all MCP requests, responses, and errors
- **Health Monitoring** - Real-time health checks and status tracking for all servers
- **Web Dashboard** - Intuitive web UI for browsing logs and managing servers
- **REST API** - Query logs programmatically for integration with other tools
- **Metrics & Analytics** - Track server activity, response times, and error patterns

## Quick Start

### Installation

```bash
npm install -g @fiberplane/mcp-gateway
```

Or with yarn:
```bash
yarn global add @fiberplane/mcp-gateway
```

### Start the Gateway

```bash
mcp-gateway
```

This launches:
- **Web UI** - http://localhost:3333/ui
- **API** - REST API on http://localhost:3333/api

### Add Your First Server

1. Open the Web UI at http://localhost:3333/ui
2. Click "Add Server"
3. Enter server name and URL
4. Gateway will perform a health check
5. Start making MCP requests - traffic will be captured automatically

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Gateway                              │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  Web UI      │  │   REST API  │  │   MCP Protocol   │  │
│  │  (React)     │  │   (/api)    │  │   Gateway        │  │
│  └──────┬───────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                 │                  │             │
│         └─────────────────┼──────────────────┘             │
│                           │                                 │
│         ┌─────────────────▼──────────────────┐             │
│         │     Storage & Log Management       │             │
│         │  (SQLite + mcp.json registry)      │             │
│         └─────────────────┬──────────────────┘             │
│                           │                                 │
│         ┌─────────────────▼──────────────────┐             │
│         │    MCP Server Router & Proxy       │             │
│         │  (Routes requests to servers)      │             │
│         └─────────────────┬──────────────────┘             │
│                           │                                 │
└───────────────────────────┼────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
         ┌──────▼───┐ ┌────▼────┐ ┌───▼──────┐
         │  MCP     │ │   MCP   │ │   MCP    │
         │ Server 1 │ │ Server 2│ │ Server N │
         └──────────┘ └─────────┘ └──────────┘
```

## CLI Options

```bash
# Start with custom port
mcp-gateway --port 8080

# Custom storage directory
mcp-gateway --storage-dir /custom/path

# Show help
mcp-gateway --help

# Show version
mcp-gateway --version
```

## Configuration

MCP Gateway stores configuration and logs in `~/.mcp-gateway/`:

```bash
~/.mcp-gateway/
├── mcp.json           # Server registry configuration
├── logs.db            # SQLite database with captured traffic
└── logs.db-*          # Database files
```

### Server Configuration

Servers are managed through the Web UI or by editing `~/.mcp-gateway/mcp.json`:

```json
{
  "servers": [
    {
      "name": "my-server",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  ]
}
```

## Web UI

Access the web dashboard at `http://localhost:3333/ui` after starting the gateway.

Features:
- **Activity Log** - View all captured MCP traffic with filtering
- **Server Management** - Add, edit, remove, and monitor servers
- **Health Status** - Real-time health checks for all servers
- **Export Logs** - Export captured traffic as JSON
- **Search & Filter** - Find specific requests by server, method, or content

## REST API

The gateway exposes a REST API for programmatic access to logs and server management.

### Base URL

```
http://localhost:3333/api
```

### Endpoints

#### Get Logs
```bash
GET /api/logs
GET /api/logs?server=my-server
GET /api/logs?session=abc123
```

#### Get Servers
```bash
GET /api/servers
```

#### Add Server
```bash
POST /api/servers
Content-Type: application/json

{
  "name": "my-server",
  "url": "http://localhost:3000/mcp"
}
```

#### Health Check
```bash
GET /api/health
```

See full API documentation at `/api/docs` when the gateway is running.

## MCP Protocol Gateway

The gateway proxies MCP requests through the `/s/{serverName}/mcp` endpoint pattern:

```
http://localhost:3333/s/my-server/mcp
```

### Example: Using with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-server": {
      "url": "http://localhost:3333/s/my-server/mcp"
    }
  }
}
```

All MCP traffic will be captured and logged automatically.

## Troubleshooting

### Port Already in Use

```bash
# Use a different port
mcp-gateway --port 8080
```

### Cannot Connect to Server

1. Verify server is running: `curl http://localhost:3000/mcp`
2. Check server URL in configuration
3. View logs in Web UI Activity Log
4. Check gateway logs: `~/.mcp-gateway/logs/`

### Web UI Shows 404

Ensure you're accessing the correct URL:
```
http://localhost:3333/ui
```

Not `http://localhost:3333` (root returns JSON)

### Clear All Data

```bash
# Remove all configuration and logs
rm -rf ~/.mcp-gateway/

# Restart gateway
mcp-gateway
```

## Development

This is a Bun workspace monorepo. To contribute:

```bash
# Clone repository
git clone https://github.com/fiberplane/mcp-gateway.git
cd mcp-gateway

# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun run test

# Build all packages
bun run build
```

See [CLAUDE.md](../../CLAUDE.md) for detailed development guidelines.

## License

MIT

## Links

- **GitHub**: https://github.com/fiberplane/mcp-gateway
- **npm**: https://www.npmjs.com/package/@fiberplane/mcp-gateway
- **Issues**: https://github.com/fiberplane/mcp-gateway/issues
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)

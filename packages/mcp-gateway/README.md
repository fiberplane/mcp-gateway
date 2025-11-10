# MCP Gateway

**A unified gateway for managing and monitoring MCP (Model Context Protocol) servers in production.**

MCP Gateway provides a centralized platform for discovering, routing, and logging all MCP protocol traffic. Use it to manage multiple MCP servers, capture detailed interaction logs, and troubleshoot integration issues with Claude and other AI clients.

![Screenshot](https://github.com/fiberplane/mcp-gateway/raw/main/packages/mcp-gateway/assets/mcp-gateway.jpg)

## Features

### Core Capabilities
- **Dual-Mode Operation** - Acts as both an MCP proxy server AND an MCP server itself
- **Server Management** - Add, remove, and monitor MCP servers from web UI, API, or via MCP tools
- **Traffic Capture** - Automatic logging of all MCP requests, responses, and errors
- **Health Monitoring** - Real-time health checks and status tracking for all servers
- **Programmatic Control** - Manage gateway via REST API, web UI, or MCP protocol

### User Interfaces
- **Web Dashboard** - Intuitive React UI for browsing logs and managing servers
- **Gateway MCP Server** - Control gateway itself using MCP tools (add/remove servers, query traffic)
- **REST API** - Programmatic access to logs and server management (powers web UI)

### Analytics
- **Metrics & Analytics** - Track server activity, response times, and error patterns
- **Traffic Analysis** - Search captured traffic by server, session, method, or content

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
- **Web UI** - http://localhost:3333/ui (visual dashboard)
- **Gateway MCP Server** - http://localhost:3333/gateway/mcp (control gateway via MCP)

### Alternatively you can run the mcp-gateway from the repo

This repository requires bun to be installed.

```bash
# 1. Clone repository
git clone https://github.com/fiberplane/mcp-gateway.git
cd mcp-gateway

# 2. Install dependencies
bun install

# 3. Build packages (required for web UI)
bun run build

# 4. Start gateway in dev mode (with hot reload)
bun run dev
```

### Add Your First Server

You can add servers via the web UI:

1. Open http://localhost:3333/ui
2. Click "Add Server"
3. Enter server name and URL
4. Gateway performs health check automatically

Once added, all MCP traffic through the gateway is captured automatically. Note: if you want to add more servers, you can manage servers by clicking the cogwheel icon in the top right corner of the page. 

## Architecture Overview

The gateway operates in **dual mode**: it's both a proxy for MCP servers AND an MCP server itself.

```
┌───────────────────────────────────────────────────────────────┐
│                       MCP Gateway                             │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Web UI     │  │ Gateway MCP  │  │   MCP Proxy Router    │ │
│  │  (React)    │  │   Server     │  │  (/s/{name}/mcp)      │ │
│  │  (/ui)      │  │ (/gateway/   │  │                       │ │
│  │             │  │     mcp)     │  │  - Traffic capture    │ │
│  └──────┬──────┘  │              │  │  - Request routing    │ │
│         │         │  Tools:      │  └───────────┬───────────┘ │
│         │         │  • add_server│              │             │
│         │         │  • remove_   │              │             │
│         │         │    server    │              │             │
│         │         │  • list_     │              │             │
│         │         │    servers   │              │             │
│         │         │  • search_   │              │             │
│         │         │    records   │              │             │
│         │         └──────┬───────┘              │             │
│         └────────────────┼──────────────────────┘             │
│                          │                                    │
│         ┌────────────────▼──────────────────┐                 │
│         │     REST API (/api)               │                 │
│         │   (Powers Web UI)                 │                 │
│         └────────────────┬──────────────────┘                 │
│                          │                                    │
│         ┌────────────────▼──────────────────┐                 │
│         │  Storage & Log Management         │                 │
│         │  (SQLite + mcp.json registry)     │                 │
│         └────────────────┬──────────────────┘                 │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
               ┌───────────┼───────────┐
               │           │           │
        ┌──────▼───┐  ┌────▼────┐  ┌───▼──────┐
        │  MCP     │  │   MCP   │  │   MCP    │
        │ Server 1 │  │ Server 2│  │ Server N │
        └──────────┘  └─────────┘  └──────────┘
```

**Key Endpoints:**
- `/ui` - Web dashboard for visual management
- `/gateway/mcp` - Gateway's own MCP server (manage gateway via MCP protocol)
- `/s/{server-name}/mcp` - Proxy to registered MCP servers (traffic capture enabled)
- `/api/*` - REST API (used by web UI, available for programmatic access)

## CLI Options

```bash
# Start with custom port
mcp-gateway --port 8080

# Custom storage directory
mcp-gateway --storage-dir /custom/path

# Enable debug logging
DEBUG=* mcp-gateway

# Show help
mcp-gateway --help

# Show version
mcp-gateway --version
```

**Environment Variables:**
- `MCP_GATEWAY_PORT` - Server port (default: 3333)
- `MCP_GATEWAY_STORAGE` - Storage directory (default: ~/.mcp-gateway)
- `DEBUG` - Debug logging (`*` for all, `@fiberplane/*` for gateway only)

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

## Gateway MCP Server

The gateway exposes its own MCP server with tools for programmatic control. This lets you manage the gateway using any MCP client (like Claude Desktop, Continue, etc.).

### Endpoint

```
http://localhost:3333/gateway/mcp
```

### Available Tools

#### `add_server`
Add a new MCP server to the gateway registry.

**Parameters:**
- `name` (string) - Unique server identifier (alphanumeric, hyphens, underscores)
- `url` (string) - Full HTTP/HTTPS URL to the MCP server
- `headers` (object, optional) - Custom HTTP headers for authentication

**Example:**
```json
{
  "name": "weather-api",
  "url": "http://localhost:3001/mcp",
  "headers": {
    "Authorization": "Bearer token123"
  }
}
```

#### `remove_server`
Remove a server from the gateway registry.

**Parameters:**
- `name` (string) - Name of the server to remove

#### `list_servers`
List all registered servers with optional filtering.

**Parameters:**
- `filter` (enum, optional) - "all", "active", or "inactive" (default: "all")
- `format` (enum, optional) - "concise" or "detailed" (default: "concise")

#### `search_records`
Search and analyze captured MCP traffic.

**Parameters:**
- `serverName` (string, optional) - Filter by server name
- `sessionId` (string, optional) - Filter by session ID
- `method` (string, optional) - Filter by JSON-RPC method (partial match)
- `limit` (number, optional) - Max records to return (default: 100, max: 1000)
- `order` (enum, optional) - "asc" or "desc" (default: "desc")

### Using with MCP Clients

Any MCP client that supports HTTP transport can connect to the gateway's MCP server:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpTransport } from "@modelcontextprotocol/sdk/transport/http.js";

const client = new Client({
  name: "my-client",
  version: "1.0.0"
});

await client.connect(
  new HttpTransport("http://localhost:3333/gateway/mcp")
);

// List all servers
const result = await client.request({
  method: "tools/call",
  params: {
    name: "list_servers",
    arguments: { filter: "all", format: "detailed" }
  }
});
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

The gateway includes a REST API primarily used by the web UI. It's available for programmatic access if needed.

### Base URL

```
http://localhost:3333/api
```

### Common Endpoints

- `GET /api/logs` - Query captured traffic (supports filtering by server, session)
- `GET /api/servers` - List registered servers
- `POST /api/servers` - Add new server
- `GET /api/health` - Health check

**Note:** For programmatic control, consider using the gateway's MCP server instead (see "Gateway MCP Server" section above). The REST API is primarily designed for web UI integration.

## Using the Gateway as a Proxy

The gateway proxies MCP requests to registered servers through the `/s/{serverName}/mcp` endpoint pattern. This enables traffic capture and centralized management.

### Proxy Endpoint Pattern

```
http://localhost:3333/s/{serverName}/mcp
```

**Example:** For a server named "weather-api":
```
http://localhost:3333/s/weather-api/mcp
```

### Connecting MCP Clients Through the Proxy

To connect any MCP client (that supports HTTP transport) to an MCP server **through the gateway** (enabling traffic capture):

**Example with custom MCP client:**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { HttpTransport } from "@modelcontextprotocol/sdk/transport/http.js";

const client = new Client({ name: "my-app", version: "1.0.0" });

// Connect to the MCP server THROUGH the gateway proxy
await client.connect(
  new HttpTransport("http://localhost:3333/s/weather-api/mcp")
);
```

All requests will:
1. Route through the gateway
2. Be captured and logged to SQLite
3. Be proxied to the actual server at its configured URL
4. Return responses to your client

You can then view all captured traffic in the web UI at http://localhost:3333/ui

**Note:** Claude Desktop does not support HTTP-based MCP servers, so it cannot connect through the gateway's proxy endpoints. The gateway is primarily useful for custom MCP clients or applications that support HTTP transport.

### Direct vs Proxied Connections

```
Direct Connection (no capture):
MCP Client → http://localhost:3001/mcp → MCP Server

Proxied Connection (with capture):
MCP Client → http://localhost:3333/s/weather/mcp → Gateway → MCP Server
                                                   ↓
                                            SQLite Storage
```

## Troubleshooting

**Port already in use:**
```bash
mcp-gateway --port 8080
```

**Cannot connect to server:**
1. Verify server is running: `curl http://localhost:3000/mcp`
2. Check server URL in web UI
3. View captured traffic in Activity Log

**Web UI shows 404:**
- Use `http://localhost:3333/ui` (not root `/`)

**Clear all data:**
```bash
rm -rf ~/.mcp-gateway/ && mcp-gateway
```

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for complete guide.

## Development

This is a Bun workspace monorepo. To contribute or run locally:

### Prerequisites

Install [Bun](https://bun.sh):
```bash
curl -fsSL https://bun.sh/install | bash
```

### Quick Start for Contributors

Follow the instructions under [Running mcp-gateway from the repo](#Running-mcp-gateway-from-the-repo)

### Local Testing Workflow

```bash
# Terminal 1: Start test MCP server (for testing proxy functionality)
bun run --filter test-mcp-server dev

# Terminal 2: Start gateway
bun run dev

# Terminal 3: Add test server via API
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name": "test-server", "url": "http://localhost:3001/mcp"}'

# View logs in web UI: http://localhost:3333/ui
```

### Development Commands

```bash
# Run tests
bun run test

# Type checking
bun run typecheck

# Lint and format
bun run lint
bun run format

# Build all packages
bun run build

# Web UI dev server (with hot reload)
bun run --filter @fiberplane/mcp-gateway-web dev

# Check circular dependencies
bun run check-circular
```

### Package-Specific Development

```bash
# Work on specific packages
bun run --filter @fiberplane/mcp-gateway-core test
bun run --filter @fiberplane/mcp-gateway-api build
bun run --filter @fiberplane/mcp-gateway-server dev
```

**For contributors:**
- See [AGENTS.md](https://github.com/fiberplane/mcp-gateway/blob/main/AGENTS.md) for complete development guide
- Release process documented in AGENTS.md (changesets, npm lifecycle hooks, dependency management)

## License

MIT

## Links

- **GitHub**: https://github.com/fiberplane/mcp-gateway
- **npm**: https://www.npmjs.com/package/@fiberplane/mcp-gateway
- **Issues**: https://github.com/fiberplane/mcp-gateway/issues
- **Changelog**: [CHANGELOG.md](https://github.com/fiberplane/mcp-gateway/blob/main/packages/mcp-gateway/CHANGELOG.md)

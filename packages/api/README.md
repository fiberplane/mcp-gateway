# @fiberplane/mcp-gateway-api

REST API for querying MCP Gateway logs and managing servers.

## Overview

This package provides HTTP endpoints for querying logs captured by the MCP Gateway and managing MCP server configurations. It exposes both read-only log query endpoints and CRUD operations for server management.

The API is built with [Hono](https://hono.dev/) and can be mounted in any Hono application or run as a standalone server.

## Features

- **Query logs** - Search and filter captured MCP traffic
- **Server aggregations** - View statistics per MCP server
- **Session tracking** - Analyze individual client sessions
- **Server management** - Add, update, and delete MCP server configurations (optional)
- **Dependency injection** - Pass in your own query implementations for testing

## API Endpoints

### GET /logs

Query logs with filters and pagination.

**Query Parameters:**
- `server` - Filter by server name
- `session` - Filter by session ID
- `method` - Filter by MCP method (supports partial matching)
- `after` - Filter by timestamp (ISO 8601 datetime)
- `before` - Filter by timestamp (ISO 8601 datetime)
- `limit` - Maximum number of results (default: 100, max: 1000)
- `order` - Sort order: `asc` or `desc` (default: `desc`)

**Example:**
```bash
curl "http://localhost:3333/api/logs?server=demo&limit=10&order=desc"
```

### GET /servers

List all servers that have captured logs.

**Example:**
```bash
curl "http://localhost:3333/api/servers"
```

**Response:**
```json
{
  "servers": [
    {
      "name": "demo",
      "status": "online"
    }
  ]
}
```

### GET /sessions

List all sessions with time ranges.

**Query Parameters:**
- `server` - Optional server name filter

**Example:**
```bash
curl "http://localhost:3333/api/sessions?server=demo"
```

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "stateless",
      "serverName": "demo",
      "startTime": "2025-10-08T22:02:08.249Z",
      "endTime": "2025-10-15T16:59:28.570Z"
    }
  ]
}
```

### GET /servers/config

List all registered server configurations (requires `serverManagement` option).

**Example:**
```bash
curl "http://localhost:3333/api/servers/config"
```

**Response:**
```json
{
  "servers": [
    {
      "name": "demo",
      "url": "http://localhost:3001",
      "type": "http",
      "headers": {
        "Authorization": "Bearer token"
      }
    }
  ]
}
```

### POST /servers/config

Add a new server configuration (requires `serverManagement` option).

**Request Body:**
```json
{
  "name": "my-server",
  "url": "http://localhost:3001",
  "type": "http",
  "headers": {
    "Authorization": "Bearer token"
  }
}
```

### PUT /servers/config/:name

Update an existing server configuration (requires `serverManagement` option).

**Request Body:**
```json
{
  "url": "http://localhost:3002",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

### DELETE /servers/config/:name

Delete a server configuration (requires `serverManagement` option).

## Usage

### Basic Usage (Query API Only)

```typescript
import { createApp } from "@fiberplane/mcp-gateway-api";
import { logger } from "@fiberplane/mcp-gateway-core";
import { Hono } from "hono";

const app = new Hono();

// Create API with query functions only
const apiApp = createApp({
  queries: {
    queryLogs: (options) => storage.query(options),
    getServers: () => storage.getServers(),
    getSessions: (serverName) => storage.getSessions(serverName),
    getClients: () => storage.getClients(),
    clearSessions: () => storage.clearAll(),
  },
  logger,
});

// Mount at /api
app.route("/api", apiApp);

export default app;
```

### With Server Management

```typescript
import { createApp } from "@fiberplane/mcp-gateway-api";
import { logger } from "@fiberplane/mcp-gateway-core";
import { Hono } from "hono";

const app = new Hono();

// Create API with query functions AND server management
const apiApp = createApp({
  queries: {
    queryLogs: (options) => storage.query(options),
    getServers: () => storage.getServers(),
    getSessions: (serverName) => storage.getSessions(serverName),
    getClients: () => storage.getClients(),
    clearSessions: () => storage.clearAll(),
  },
  logger,
  serverManagement: {
    getRegisteredServers: () => storage.getRegisteredServers(),
    addServer: (config) => storage.addServer(config),
    updateServer: (name, changes) => storage.updateServer(name, changes),
    removeServer: (name) => storage.removeServer(name),
  },
});

// Mount at /api
app.route("/api", apiApp);

export default app;
```

### Standalone Server

```typescript
import { createApp } from "@fiberplane/mcp-gateway-api";
import { logger } from "@fiberplane/mcp-gateway-core";

const apiApp = createApp({
  queries: {
    queryLogs: (options) => storage.query(options),
    getServers: () => storage.getServers(),
    getSessions: (serverName) => storage.getSessions(serverName),
    getClients: () => storage.getClients(),
    clearSessions: () => storage.clearAll(),
  },
  logger,
});

Bun.serve({
  fetch: apiApp.fetch,
  port: 3000,
});

console.log("API server running at http://localhost:3000");
```

## Architecture

The API uses dependency injection for query functions, making it:

- **Testable** - Inject mock functions for testing
- **Flexible** - Use custom storage implementations
- **Decoupled** - No direct dependency on storage internals

The API package only depends on:
- `@fiberplane/mcp-gateway-core` (type imports only)
- `hono` - Web framework
- `zod` - Schema validation
- `@hono/standard-validator` - Request validation middleware

## Integration with Web UI

The API is consumed by the `@fiberplane/mcp-gateway-web` package, which provides a React-based interface for browsing logs.

### In Production

The server package (`@fiberplane/mcp-gateway-server`) integrates both the API and web UI:

```typescript
import { createApp } from "@fiberplane/mcp-gateway-server";

const { app } = await createApp(registry, storageDir, eventHandlers, {
  publicDir: "./public", // Web UI static files
});

// API mounted at /api/*
// Web UI served at /ui/*
```

### In Development

For web UI development, run both the API and web dev server:

```bash
# Terminal 1: API server
bun run --filter @fiberplane/mcp-gateway-api dev

# Terminal 2: Web UI dev server (with Vite HMR)
bun run --filter @fiberplane/mcp-gateway-web dev
```

The web UI dev server proxies API requests to `http://localhost:3333/api`.

### CORS Configuration

The API includes CORS middleware for development to allow connections from the Vite dev server (port 5173).

## Development

```bash
# Build
bun run build

# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format
```

## See Also

- [@fiberplane/mcp-gateway-web](../web) - Web UI for browsing logs
- [@fiberplane/mcp-gateway-server](../server) - HTTP server with proxy
- [@fiberplane/mcp-gateway-core](../core) - Core business logic

## License

MIT

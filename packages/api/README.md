# @fiberplane/mcp-gateway-api

REST API for querying MCP Gateway logs.

## Overview

This package provides HTTP endpoints for querying logs captured by the MCP Gateway. It exposes a read-only API for accessing log data, server statistics, and session information.

The API is built with [Hono](https://hono.dev/) and can be mounted in any Hono application or run as a standalone server.

## Features

- **Query logs** - Search and filter captured MCP traffic
- **Server aggregations** - View statistics per MCP server
- **Session tracking** - Analyze individual client sessions
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

List all servers with log counts and session counts.

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
      "logCount": 788,
      "sessionCount": 1
    }
  ]
}
```

### GET /sessions

List all sessions with log counts and time ranges.

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
      "logCount": 788,
      "startTime": "2025-10-08T22:02:08.249Z",
      "endTime": "2025-10-15T16:59:28.570Z"
    }
  ]
}
```

## Usage

### Mounting in a Hono App

```typescript
import { createApp } from "@fiberplane/mcp-gateway-api";
import { queryLogs, getServers, getSessions } from "@fiberplane/mcp-gateway-core";
import { Hono } from "hono";

const app = new Hono();

// Create API with injected query functions
const apiApp = createApp("~/.mcp-gateway", {
  queryLogs,
  getServers,
  getSessions,
});

// Mount at /api
app.route("/api", apiApp);

export default app;
```

### Standalone Server

```typescript
import { createApp } from "@fiberplane/mcp-gateway-api";
import { queryLogs, getServers, getSessions } from "@fiberplane/mcp-gateway-core";

const apiApp = createApp("~/.mcp-gateway", {
  queryLogs,
  getServers,
  getSessions,
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

## License

MIT

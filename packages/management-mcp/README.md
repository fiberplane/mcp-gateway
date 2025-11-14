# @fiberplane/mcp-gateway-management-mcp

MCP protocol API for managing the MCP Gateway. This package provides a complete MCP server that exposes tools for managing the gateway's server registry and analyzing captured MCP traffic.

## Overview

The management MCP server allows MCP clients (like Claude Desktop) to interact with the gateway programmatically using the MCP protocol. This enables:

- **Server Management**: Add, remove, and list MCP servers registered with the gateway
- **Traffic Analysis**: Search and analyze captured MCP traffic records
- **Gateway Control**: Manage the gateway's configuration and operational state

## Installation

This package is internal to the MCP Gateway monorepo and is not published independently. It's automatically included when you install `@fiberplane/mcp-gateway`.

## Usage

```typescript
import { createMcpApp } from "@fiberplane/mcp-gateway-management-mcp";
import { Gateway } from "@fiberplane/mcp-gateway-core";

// Create gateway instance
const gateway = new Gateway(/* ... */);

// Create management MCP app
const mcpApp = createMcpApp(gateway);

// Mount in your main application
app.route("/gateway", mcpApp);
app.route("/g", mcpApp); // Short alias
```

## Available Tools

### Server Management

- **`add_server`**: Register a new MCP server with the gateway
- **`remove_server`**: Remove an MCP server from the registry
- **`list_servers`**: List all registered servers with optional filtering and formatting

### Traffic Analysis

- **`search_records`**: Search captured MCP traffic records with flexible filtering options

## Architecture

This package is part of the MCP Gateway's management layer, separate from the proxy infrastructure:

```
Gateway Architecture
├── Server Package (proxy + OAuth)      ← No auth
├── API Package (REST management)       ← Needs auth
└── Management MCP Package              ← Needs auth
    ├── MCP protocol handling
    ├── Server management tools
    └── Capture analysis tools
```

## Security

⚠️ **This package does NOT include built-in authentication**. The MCP server is designed to be auth-agnostic, allowing the orchestration layer (CLI package) to wrap it with authentication middleware.

When deploying, ensure you:
- Protect the management MCP endpoints with authentication
- Use HTTPS in production
- Restrict access to authorized users only

## Development

```bash
# Build the package
bun run build

# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format
```

## Dependencies

- **@fiberplane/mcp-gateway-core**: Gateway business logic
- **@fiberplane/mcp-gateway-types**: Shared type definitions
- **hono**: HTTP server framework
- **mcp-lite**: MCP protocol implementation
- **zod**: Schema validation

## License

MIT

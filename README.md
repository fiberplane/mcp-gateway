# MCP Gateway

**A unified gateway for managing and monitoring MCP (Model Context Protocol) servers in production.**

MCP Gateway provides a centralized platform for discovering, routing, and logging all MCP protocol traffic. Use it to manage multiple MCP servers, capture detailed interaction logs, and troubleshoot integration issues with Claude and other AI clients.

## Features

- **Server Management** - Add, remove, and monitor MCP servers from a single dashboard
- **Traffic Capture** - Automatic logging of all MCP requests, responses, and errors
- **Health Monitoring** - Real-time health checks and status tracking for all servers
- **Web Dashboard** - Intuitive web UI for browsing logs and managing servers
- **Terminal UI** - Full-featured TUI for command-line power users
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

This launches both:
- **Web UI** - http://localhost:3333/ui
- **TUI** - Terminal interface in the same terminal
- **API** - REST API on http://localhost:3333/api

### Add Your First Server

1. Open the Web UI or TUI
2. Press `A` (TUI) or click "Add Server" (Web)
3. Enter server name and URL
4. Gateway will perform a health check
5. Start making MCP requests - traffic will be captured automatically

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Gateway                              │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  Web UI      │  │  Terminal   │  │   REST API       │  │
│  │  (React)     │  │   UI        │  │   (/api)         │  │
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

## Project Structure

This is a **Bun workspace monorepo** with the following packages:

- **`@fiberplane/mcp-gateway-types`** - Type definitions and schemas
- **`@fiberplane/mcp-gateway-core`** - Core business logic (capture, storage, registry)
- **`@fiberplane/mcp-gateway-api`** - REST API for querying logs
- **`@fiberplane/mcp-gateway-server`** - MCP protocol HTTP server
- **`@fiberplane/mcp-gateway-web`** - React-based web UI
- **`@fiberplane/mcp-gateway-cli`** - CLI entry point (public, distributed as binary)
- **`@fiberplane/mcp-gateway`** - Public wrapper package for npm

See [Monorepo Structure](./docs/development/monorepo-structure.md) for detailed information.

## Documentation

### For Users

- **[Getting Started](./docs/user-guide/getting-started.md)** - Installation and first steps
- **[Web UI Guide](./docs/user-guide/web-ui-guide.md)** - Using the dashboard
- **[CLI Reference](./docs/user-guide/cli-reference.md)** - Command-line usage
- **[Troubleshooting](./docs/user-guide/troubleshooting.md)** - Common issues
- **[FAQ](./docs/user-guide/faq.md)** - Frequently asked questions

### For Developers

- **[Architecture](./docs/architecture/overview.md)** - System design and components
- **[API Reference](./docs/api/specification.md)** - REST API endpoints
- **[Development Setup](./docs/development/setup.md)** - Local development
- **[Contributing](./CONTRIBUTING.md)** - How to contribute

### For Operations

- **[Binary Distribution](./docs/deployment/binary-distribution.md)** - How binaries work
- **[Security](./SECURITY.md)** - Security model and considerations
- **[Deployment](./docs/deployment/docker.md)** - Production deployment

## Use Cases

### 1. Debug MCP Integration Issues
Capture all traffic between Claude and your MCP servers to diagnose problems:
- View exact request/response payloads
- Check error messages and stack traces
- Analyze response times and performance

### 2. Monitor Server Health
Track server availability and performance:
- Real-time health status
- Last activity timestamp
- Request count and error rates

### 3. Manage Multiple Servers
Centralized management of distributed MCP servers:
- Add/remove servers on demand
- View all servers in one place
- Quick health checks

### 4. Integrate with CI/CD
Query logs programmatically via REST API:
- Check server health before deployment
- Validate MCP traffic patterns
- Automate troubleshooting workflows

## Technology Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Backend**: Hono (web framework), Drizzle (database ORM), SQLite (data storage)
- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS
- **Terminal UI**: OpenTUI, React for terminal components
- **Protocol**: MCP (Model Context Protocol)

## Requirements

- **Node.js 18+** or **Bun 1.0+**
- **Storage**: ~100MB disk space (configurable)
- **Memory**: ~50MB minimum, scales with active sessions

## Getting Help

- **[Troubleshooting Guide](./docs/user-guide/troubleshooting.md)** - Common issues
- **[FAQ](./docs/user-guide/faq.md)** - Frequently asked questions
- **[GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues)** - Report bugs
- **[Discussions](https://github.com/fiberplane/mcp-gateway/discussions)** - Ask questions

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- How to set up development environment
- Coding standards and guidelines
- Pull request process
- Commit message conventions

## License

[Your License Here] - See LICENSE file for details

## Security

For security issues, see [SECURITY.md](./SECURITY.md) for:
- Security model overview
- Vulnerability reporting process
- Data privacy considerations

---

**[→ Get Started Now](./docs/user-guide/getting-started.md)** | **[→ View Architecture](./docs/architecture/overview.md)** | **[→ API Reference](./docs/api/specification.md)**

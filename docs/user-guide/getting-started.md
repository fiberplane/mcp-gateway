# Getting Started with MCP Gateway

Welcome! This guide will help you install and start using MCP Gateway in 5 minutes.

## What is MCP Gateway?

MCP Gateway is a **centralized management system for MCP (Model Context Protocol) servers**. It:

- 🎯 **Manages** multiple MCP servers from one dashboard
- 📊 **Logs** all MCP traffic for debugging and analysis
- 🏥 **Monitors** server health in real-time
- 🔍 **Analyzes** request patterns and performance

Perfect for:
- Debugging MCP integrations
- Monitoring server availability
- Troubleshooting failed requests
- Understanding MCP traffic patterns

## Installation

### Option 1: NPM (Recommended)

```bash
npm install -g @fiberplane/mcp-gateway
```

Or with yarn:
```bash
yarn global add @fiberplane/mcp-gateway
```

### Option 2: Bun

```bash
bun add -g @fiberplane/mcp-gateway
```

### Option 3: Development Installation

See [Development Setup](../development/setup.md) to build from source.

## Starting the Gateway

After installation, start the gateway:

```bash
mcp-gateway
```

You'll see output like:

```
✨ MCP Gateway starting...

🌐 Web UI:      http://localhost:3333/ui
📡 REST API:    http://localhost:3333/api

Gateway ready on port 3333
```

The gateway now runs in your terminal. Don't close it!

## First Steps

### 1. Open the Web UI

Click [http://localhost:3333/ui](http://localhost:3333/ui) or paste into your browser.

You'll see an empty dashboard with a "Add Server" button.

### 2. Add Your First Server

**Using Web UI:**
1. Click "Add Server"
2. Enter a name (e.g., "my-server")
3. Enter the URL (e.g., "http://localhost:5000")
4. Click "Add"

Gateway will perform a health check and show the result.

**Using REST API:**
```bash
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "url": "http://localhost:5000"
  }'
```

### 3. Start Making Requests

Now make requests to your MCP server through the gateway:

```bash
# Example: Make an MCP request through the gateway
curl -X POST http://localhost:3333/mcp/my-server \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

The gateway captures all traffic automatically! 📝

### 4. View Captured Logs

Refresh the Web UI to see captured requests and responses:

- **Request details**: Method, parameters, headers
- **Response details**: Result or error
- **Timing**: Duration in milliseconds
- **Status**: HTTP status code

Click on a log entry to see full JSON details.

## Common Tasks

### Check Server Health

**Web UI:**
- Look at the status indicator next to each server
- See "Last Activity" and request count

**REST API:**
```bash
curl http://localhost:3333/api/servers
```

### Filter Logs

**Web UI:**
1. Click the filter icon
2. Select server name and date range
3. Results update automatically

**REST API:**
```bash
# Filter by server and time range
curl "http://localhost:3333/api/logs?server=my-server&since=2024-10-22"
```

### Remove a Server

**Web UI:**
1. Click the server entry
2. Click "Remove"
3. Confirm deletion (logs are preserved)

**REST API:**
```bash
curl -X DELETE http://localhost:3333/api/servers/my-server
```

### Clear Logs

**Web UI:**
1. Click the menu
2. Find "Clear Logs"
3. Confirm

**REST API:**
```bash
curl -X DELETE http://localhost:3333/api/logs
```

## Configuration

### Storage Location

By default, MCP Gateway stores data in:

```
~/.mcp-gateway/
├── mcp.json          # Server configuration
└── logs.db           # Captured traffic
```

### Custom Storage Location

```bash
MCP_GATEWAY_STORAGE=/path/to/storage mcp-gateway
```

### Environment Variables

```bash
# Custom storage directory
MCP_GATEWAY_STORAGE=/custom/path

# Custom port (default: 3333)
MCP_GATEWAY_PORT=8080

# Enable debug logging
DEBUG=*
```

## Troubleshooting

### Gateway won't start

**Error: "Port already in use"**
```bash
# Use different port
MCP_GATEWAY_PORT=3334 mcp-gateway
```

**Error: "Permission denied"**
```bash
# Fix permissions
chmod 700 ~/.mcp-gateway
```

### Server shows "Health: unknown"

- Server may not be running
- Check the server URL is correct
- See if server is on `localhost` vs `127.0.0.1`
- Check firewall settings

### No logs appearing

- Make sure you're making requests to the gateway, not directly to the server
- Use the correct server name in the URL path
- Check that the server is actually receiving requests

### Web UI not loading

- Check browser console for errors (F12)
- Clear browser cache
- Try a different browser
- Check that gateway is running: `curl http://localhost:3333/ui`

See [Troubleshooting Guide](./troubleshooting.md) for more issues.

## Next Steps

### Learn More

- **[Web UI Guide](./web-ui-guide.md)** - Features and usage
- **[CLI Reference](./cli-reference.md)** - Command-line options
- **[API Reference](../api/specification.md)** - Programmatic access
- **[Architecture](../architecture/overview.md)** - How it works

### Advanced Usage

- **[Filtering Logs](./web-ui-guide.md#filtering)** - Advanced log queries
- **[Custom Headers](../api/specification.md#adding-servers)** - Authentication
- **[REST API Integration](../api/specification.md)** - Automate workflows
- **[Development Setup](../development/setup.md)** - Contributing code

### Common Scenarios

**Scenario: Debug Claude integration**
1. Add your MCP server URL to gateway
2. Configure Claude to use gateway URL
3. Make requests through Claude
4. View captured traffic in gateway UI

**Scenario: Monitor multiple servers**
1. Add all server URLs
2. Gateway shows health status
3. Web UI shows metrics for all servers
4. Query logs across all servers

**Scenario: Automated testing**
1. Start gateway with custom port
2. Make requests via REST API
3. Query logs to validate responses
4. Integrate with test suite

## Tips & Best Practices

### Development

✅ Keep gateway running while developing
✅ Use web UI for server management and monitoring
✅ Check "Last Activity" to confirm requests
✅ Search logs by timestamp for debugging

### Production Readiness

⚠️ **Not recommended for production** without hardening
- See [Security](../../SECURITY.md) for considerations
- Run in isolated environment
- Implement log rotation
- Use reverse proxy with authentication

## Getting Help

- **[FAQ](./faq.md)** - Common questions
- **[Troubleshooting](./troubleshooting.md)** - Problem solutions
- **[GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues)** - Report bugs
- **[Discussions](https://github.com/fiberplane/mcp-gateway/discussions)** - Ask questions

## Quick Reference

```bash
# Install
npm install -g @fiberplane/mcp-gateway

# Start
mcp-gateway

# With custom port
MCP_GATEWAY_PORT=8080 mcp-gateway

# With custom storage
MCP_GATEWAY_STORAGE=/custom/path mcp-gateway

# With debug logging
DEBUG=* mcp-gateway

# Add server
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name":"test","url":"http://localhost:5000"}'

# Query logs
curl "http://localhost:3333/api/logs?server=test"

# List servers
curl http://localhost:3333/api/servers

# View help
mcp-gateway --help
```

---

**Ready to get started?** Open [http://localhost:3333/ui](http://localhost:3333/ui) now!

**Next:** Read [Web UI Guide](./web-ui-guide.md) to learn more features.

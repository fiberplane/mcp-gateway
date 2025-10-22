# Frequently Asked Questions

## General Questions

### What is MCP Gateway?

MCP Gateway is a centralized management system for Model Context Protocol (MCP) servers. It provides:

- **Server Management**: Register and monitor multiple MCP servers
- **Traffic Capture**: Automatic logging of all MCP requests and responses
- **Multiple Interfaces**: Web UI, Terminal UI, and REST API
- **Debugging**: Inspect exact MCP messages for troubleshooting
- **Health Monitoring**: Real-time status tracking for all servers

It's designed for development and debugging, not production deployment without hardening.

### Who should use MCP Gateway?

**You should use MCP Gateway if you:**
- Integrate with Claude or other AI clients via MCP
- Need to debug MCP integration issues
- Want to monitor MCP server performance
- Manage multiple MCP servers
- Need request/response inspection and logging

### Is MCP Gateway free?

Yes, MCP Gateway is open source and free to use. See [LICENSE](../../LICENSE) for details.

### What are the system requirements?

**Minimum:**
- Node.js 18+ or Bun 1.0+
- 50MB RAM
- 100MB disk space

**Recommended:**
- Bun 1.0+ (faster than Node.js)
- 256MB RAM
- 1GB disk space (for long-term log storage)

### Can I use MCP Gateway in production?

**Not recommended without hardening.** See [SECURITY.md](../../SECURITY.md) for details.

Current limitations:
- No built-in authentication
- No encryption at rest
- HTTP-only (no TLS)
- Localhost-only by default
- No rate limiting

For production, you would need to:
- Run behind reverse proxy with TLS
- Implement access control
- Monitor and audit access
- Implement log rotation
- Run with restricted permissions

## Installation and Setup

### How do I install MCP Gateway?

**Option 1: Global NPM (Recommended)**
```bash
npm install -g @fiberplane/mcp-gateway
mcp-gateway
```

**Option 2: With Yarn**
```bash
yarn global add @fiberplane/mcp-gateway
mcp-gateway
```

**Option 3: With Bun**
```bash
bun add -g @fiberplane/mcp-gateway
mcp-gateway
```

### Where does MCP Gateway store data?

By default: `~/.mcp-gateway/`

Contains:
- `mcp.json` - Server registry configuration
- `logs.db` - SQLite database with captured traffic

To use custom location:
```bash
mcp-gateway --storage /path/to/storage
```

### How do I start MCP Gateway?

```bash
mcp-gateway
```

This starts:
- Web UI: http://localhost:3333/ui
- REST API: http://localhost:3333/api
- Terminal UI: Interactive TUI in terminal

### Can I run multiple gateway instances?

Yes, use different ports:

```bash
# Terminal 1
MCP_GATEWAY_PORT=3333 mcp-gateway

# Terminal 2
MCP_GATEWAY_PORT=3334 mcp-gateway
```

Each instance has separate storage and logs.

## Server Management

### How do I add a server?

**Web UI:**
1. Click "Add Server" button
2. Enter server name and URL
3. Click "Add"

**Terminal UI:**
1. Press `A` for Add Server
2. Enter details
3. Press Enter

**REST API:**
```bash
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name": "my-server", "url": "http://localhost:5000"}'
```

### Why is server health "unknown"?

Causes:
- Server hasn't been checked yet (wait a few seconds)
- Server is not running
- Server URL is incorrect
- Firewall is blocking access

Solutions:
1. Click "Check Health" button (Web UI)
2. Wait for initial health check
3. Verify server is running and accessible

### Can I add server credentials?

**Basic Setup:**
No built-in credential management. Instead, use custom headers:

```bash
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "url": "http://localhost:5000",
    "headers": {
      "Authorization": "Bearer token123",
      "X-API-Key": "secret"
    }
  }'
```

**Security Note:**
Headers are stored in plain text in `mcp.json`. Use carefully and never commit to version control.

### Can I remove a server?

**Web UI:**
1. Click on server
2. Click "Remove Server"
3. Confirm

**Terminal UI:**
1. Select server
2. Press `R`
3. Confirm

**REST API:**
```bash
curl -X DELETE http://localhost:3333/api/servers/my-server
```

**Note:** Logs are preserved; only the server registration is removed.

### How often are health checks run?

Health checks run:
- When server is first added
- Every 30 seconds (automatic)
- When manually requested via "Check Health" button

Future enhancement: Make interval configurable.

## Using the Web UI

### How do I view captured logs?

1. Open Web UI: http://localhost:3333/ui
2. Click "Activity Log" tab
3. Logs appear as table of requests

### How do I filter logs?

**By Server:**
- Click "Filter by Server" dropdown
- Select server name

**By Time:**
- Click "Date Range" picker
- Select preset or custom range

**By Method:**
- Type in "Method Filter" field
- Matching logs appear instantly

**By Text Search:**
- Type in search box
- Searches server name, method, error message

### Can I export logs?

**Single Log:**
1. Expand log entry
2. Click "Export" button
3. Choose format: JSON, CSV, or text

**Multiple Logs:**
1. Apply filters to select logs
2. Click "Export All" button
3. Choose format and download

### How do I copy a log?

For a single log:
1. Expand log entry
2. Click "Copy JSON"
3. Paste into editor

For all logs:
1. Apply filters
2. Click "Export All"
3. Choose JSON format

### How long are logs kept?

By default: **Indefinitely**

To clear logs:
- Web UI: Click "Clear Logs" button
- REST API: `curl -X DELETE http://localhost:3333/api/logs`
- Terminal UI: Press `C`

### Can I search across all logs?

Yes, use the search box:
- Case-insensitive
- Partial matching
- Searches multiple fields

Example searches:
- `initialize` - Find all initialization requests
- `error` - Find failed requests
- `my-server` - Find logs from specific server

## Using the Terminal UI

### How do I navigate the TUI?

**Keys:**
- `↑/↓` - Navigate list items
- `Tab` - Switch between sections
- `Enter` - Select item
- `Escape` - Close modal

### What do the TUI commands do?

| Key | Action |
|-----|--------|
| `A` | Add new server |
| `R` | Remove server |
| `H` | Show health status |
| `L` | View activity logs |
| `C` | Clear all logs |
| `?` | Show help |
| `Q` | Quit |

### Can I use TUI with mouse?

Limited mouse support:
- Click to select items
- Click buttons
- Scroll with mouse wheel

Full keyboard navigation recommended.

## Logs and Data

### How are logs stored?

Logs are stored in SQLite database at `~/.mcp-gateway/logs.db`

**Features:**
- Indexed for fast queries
- WAL mode for concurrent access
- Automatic query optimization

### Can I backup logs?

Manual backup:
```bash
cp ~/.mcp-gateway/logs.db ./backup/logs.db
```

Programmatic export:
```bash
curl http://localhost:3333/api/logs > logs.json
```

### Can I import logs from another gateway?

Not currently. Logs are specific to gateway instance.

**Workaround:**
Export from one gateway, re-import by replaying requests through new gateway.

### How much storage do logs use?

Approximately:
- **1MB per 10,000 MCP exchanges**

Example:
- 100,000 requests ≈ 10MB
- 1,000,000 requests ≈ 100MB

### How do I delete logs?

**All logs:**
```bash
curl -X DELETE http://localhost:3333/api/logs
```

Or via Web UI/TUI:
- Web UI: Click "Clear Logs"
- TUI: Press `C`

**Specific logs:**
Not currently supported. Use SQL query if needed:
```bash
sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-7 days');"
```

## Performance and Scalability

### How many servers can I manage?

**Practical limit:** 100-1000 servers

Depends on:
- Filesystem limits
- Available memory
- Registry file size

### How many requests can gateway handle?

**Throughput:** 1000s of requests/second (limited by SQLite writes)

**Concurrent sessions:** 1000+

**Actual performance** depends on:
- Server response times
- Request complexity
- Hardware (CPU, disk speed)

### What happens if I send too many requests?

Gateway will:
1. Queue requests
2. Write to SQLite (may become bottleneck)
3. Continue capturing all traffic
4. Eventually exhaust memory if requests never stop

**Solutions:**
- Clear old logs periodically
- Use time range filters
- Reduce request frequency

### How do I optimize gateway performance?

**Strategies:**
1. Clear logs periodically
2. Use separate gateway instances for different purposes
3. Implement log rotation (future feature)
4. Upgrade hardware (more CPU, faster disk)
5. Replace SQLite with PostgreSQL (future option)

## API and Integration

### What APIs does gateway expose?

**REST API:**
- List servers: `GET /api/servers`
- Add server: `POST /api/servers`
- Remove server: `DELETE /api/servers/{name}`
- Query logs: `GET /api/logs`
- Clear logs: `DELETE /api/logs`

**MCP Server API:**
- Gateway exposes MCP tools for querying logs
- Access via MCP client connection to gateway

### Can I use gateway with other tools?

**Possible integrations:**
- Query logs via REST API for custom analysis
- Export logs to external services
- Monitor gateway health in observability platforms
- Trigger alerts based on log patterns

**Example:**
```bash
# Export to file for analysis
curl http://localhost:3333/api/logs > logs.json

# Process with jq
jq '.logs | group_by(.server) | map({server: .[0].server, count: length})' logs.json
```

### Is there a Python client?

Not officially, but you can use any HTTP client:

```python
import requests

# List servers
response = requests.get('http://localhost:3333/api/servers')
servers = response.json()

# Query logs
logs = requests.get('http://localhost:3333/api/logs', params={
    'server': 'my-server',
    'limit': 100
})
```

### How do I use gateway programmatically?

**Via REST API:**
Use any HTTP client to query endpoints.

**Via core package:**
```typescript
import { createGateway } from "@fiberplane/mcp-gateway-core";

const gateway = await createGateway({ storageDir: "~/.mcp-gateway" });
const servers = await gateway.registry.getServers();
const logs = await gateway.storage.query({ limit: 100 });
```

## Security and Privacy

### Is gateway secure?

**Default configuration:** Localhost-only, no authentication

**Not recommended for production** without:
- Reverse proxy with TLS
- Access authentication
- Firewall rules
- Permission restrictions

See [SECURITY.md](../../SECURITY.md) for details.

### Are OAuth tokens logged?

Yes, OAuth tokens are captured and stored in logs.

**Security implications:**
- Anyone with file access to `~/.mcp-gateway/logs.db` can read tokens
- Logs should be treated as sensitive data
- Clear logs after debugging
- Restrict file permissions

### Can I encrypt logs?

Not built-in. Options:
1. Restrict file permissions: `chmod 700 ~/.mcp-gateway/`
2. Use encrypted filesystem
3. Rotate logs and archive securely
4. Deploy in isolated environment

### What data is stored?

**Stored:**
- All MCP request/response messages
- HTTP headers
- Server configuration
- Session metadata
- Timestamps and metrics

**Not stored separately:**
- Credentials (but captured in logs if sent)
- Sensitive data (captured as-is if in messages)

### Can I redact sensitive data?

Not automatically. Options:
1. Clear logs after debugging
2. Remove sensitive logs via SQL
3. Export specific logs and delete originals
4. Use separate gateway for sensitive debugging

## Docker and Deployment

### Can I run gateway in Docker?

Yes, example Dockerfile:

```dockerfile
FROM node:18-alpine
RUN npm install -g @fiberplane/mcp-gateway
EXPOSE 3333
CMD ["mcp-gateway", "--no-tui"]
```

Build and run:
```bash
docker build -t mcp-gateway .
docker run -d -p 3333:3333 -e MCP_GATEWAY_STORAGE=/data -v mcp-data:/data mcp-gateway
```

### How do I deploy to production?

**Not recommended** without:
1. Running behind reverse proxy (nginx, Caddy)
2. Implementing authentication/authorization
3. Using TLS encryption
4. Restricting access with firewall
5. Implementing log rotation
6. Monitoring and alerting
7. Regular security updates

See [SECURITY.md](../../SECURITY.md) for production hardening.

### Can I use gateway with Kubernetes?

Yes, but needs:
- Reverse proxy for TLS/auth
- Persistent volume for logs
- NetworkPolicy for access control
- RBAC for pod access

Not officially supported yet.

## Troubleshooting

### Where do I find error messages?

**Log locations:**
1. Terminal output (if running in foreground)
2. System logs (if running as service)
3. Browser console (if using Web UI - F12)

**Enable debug logging:**
```bash
DEBUG=* mcp-gateway
```

### My logs disappeared. Can I recover them?

**Recovery options:**
1. Check if using different storage directory
2. Restore from backup if available
3. Recovery via SQLite (advanced, risky)

**Prevention:**
- Regular backups: `cp ~/.mcp-gateway/logs.db backup/`
- Don't delete storage directory accidentally

### Gateway is running but Web UI won't load

**Check:**
1. Gateway is actually running: `curl http://localhost:3333/ui`
2. Port is correct (default 3333)
3. Browser cache cleared (Ctrl+Shift+Delete)
4. Different browser (rules out browser-specific issue)

See [Troubleshooting](./troubleshooting.md) for detailed solutions.

## Contributing and Development

### Can I contribute to MCP Gateway?

Yes! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

### How do I report bugs?

1. [Check existing issues](https://github.com/fiberplane/mcp-gateway/issues)
2. [Open new issue](https://github.com/fiberplane/mcp-gateway/issues/new) with:
   - What you were doing
   - What error occurred
   - Steps to reproduce
   - Your environment (OS, versions)

### How do I request features?

Open [GitHub discussion](https://github.com/fiberplane/mcp-gateway/discussions) with:
- Feature description
- Use case
- Expected behavior

### Is there a roadmap?

Future planned features:
- Built-in TLS support
- API authentication
- Encrypted storage
- Log rotation
- Prometheus metrics export

For the latest updates, see the [GitHub project board](https://github.com/fiberplane/mcp-gateway/projects).

## Getting More Help

**Resources:**
- [Getting Started](./getting-started.md) - Installation and first steps
- [CLI Reference](./cli-reference.md) - Command-line usage
- [Web UI Guide](./web-ui-guide.md) - Dashboard features
- [Troubleshooting](./troubleshooting.md) - Common issues
- [Architecture](../architecture/overview.md) - System design

**Contact:**
- [GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues) - Bug reports
- [GitHub Discussions](https://github.com/fiberplane/mcp-gateway/discussions) - Questions
- [Email](mailto:hello@fiberplane.com) - General inquiries

---

**Didn't find what you're looking for?** Open a [GitHub Discussion](https://github.com/fiberplane/mcp-gateway/discussions) with your question!

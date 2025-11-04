# Troubleshooting and FAQ

Quick reference for common issues, questions, and solutions for MCP Gateway.

**Table of Contents:**
- [General Questions](#general-questions)
- [Installation and Setup](#installation-and-setup)
- [Startup Issues](#startup-issues)
- [Server Management](#server-management)
- [Connection and Proxy Issues](#connection-and-proxy-issues)
- [Web UI Issues](#web-ui-issues)
- [Logs and Data](#logs-and-data)
- [Performance and Scalability](#performance-and-scalability)
- [Security and Privacy](#security-and-privacy)
- [API and Integration](#api-and-integration)
- [Docker and Deployment](#docker-and-deployment)
- [Advanced Debugging](#advanced-debugging)
- [Contributing and Support](#contributing-and-support)

---

## General Questions

### What is MCP Gateway?

MCP Gateway is a centralized management system for Model Context Protocol (MCP) servers. It provides:

- **Server Management**: Register and monitor multiple MCP servers
- **Traffic Capture**: Automatic logging of all MCP requests and responses
- **Multiple Interfaces**: Web UI and REST API
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

---

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

### Can I run multiple gateway instances?

Yes, use different ports:

```bash
# Terminal 1
MCP_GATEWAY_PORT=3333 mcp-gateway

# Terminal 2
MCP_GATEWAY_PORT=3334 mcp-gateway
```

Each instance has separate storage and logs.

---

## Startup Issues

### Error: "Address already in use" or "Port 3333 is already in use"

**Cause:** Another process is using port 3333.

**Solutions:**

1. **Find and kill the conflicting process:**
   ```bash
   # macOS/Linux
   lsof -i :3333
   kill <PID>

   # Windows
   netstat -ano | findstr :3333
   taskkill /PID <PID> /F
   ```

2. **Use a different port:**
   ```bash
   MCP_GATEWAY_PORT=3334 mcp-gateway
   ```

3. **Check if another gateway instance is running:**
   ```bash
   ps aux | grep mcp-gateway
   ```

### Error: "EACCES: permission denied"

**Cause:** Insufficient permissions to access storage directory.

**Solutions:**

1. **Check directory permissions:**
   ```bash
   ls -la ~/.mcp-gateway/
   ```

2. **Fix permissions:**
   ```bash
   chmod 755 ~/.mcp-gateway/
   chmod 644 ~/.mcp-gateway/mcp.json
   chmod 644 ~/.mcp-gateway/logs.db
   ```

3. **Use custom storage directory:**
   ```bash
   mkdir -p ./gateway-data
   mcp-gateway --storage ./gateway-data
   ```

### Error: "Cannot find module" or dependencies missing

**Cause:** Installation incomplete or corrupted.

**Solutions:**

1. **Reinstall globally:**
   ```bash
   npm uninstall -g @fiberplane/mcp-gateway
   npm install -g @fiberplane/mcp-gateway
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   npm install -g @fiberplane/mcp-gateway
   ```

3. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   ```

### Gateway starts but immediately exits

**Causes:**
- Configuration file is corrupted
- Port conflict
- Unhandled exception

**Solutions:**

1. **Run with debug logging:**
   ```bash
   DEBUG=* mcp-gateway
   ```

2. **Check configuration file:**
   ```bash
   cat ~/.mcp-gateway/mcp.json
   # Should be valid JSON
   ```

3. **Reset configuration:**
   ```bash
   rm ~/.mcp-gateway/mcp.json
   mcp-gateway  # Will create new config
   ```

4. **Check system logs:**
   ```bash
   # macOS
   tail -f /var/log/system.log

   # Linux
   journalctl -u mcp-gateway -f
   ```

---

## Server Management

### How do I add a server?

**Web UI:**
1. Click "Add Server" button
2. Enter server name and URL
3. Click "Add"

**REST API:**
```bash
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{"name": "my-server", "url": "http://localhost:5000"}'
```

### Server health shows "unknown"

**Causes:**
- Server hasn't been checked yet (wait a few seconds)
- Server is not running
- Server URL is incorrect
- Firewall is blocking access
- Network connectivity issue

**Solutions:**

1. **Wait for initial health check** (runs every 30 seconds)

2. **Manually trigger health check:**
   - Web UI: Click "Check Health" button
   - API: `curl http://localhost:3333/api/servers/{name}/health`

3. **Verify server is running:**
   ```bash
   curl http://localhost:5000/health
   ```

4. **Check server URL in config:**
   ```bash
   cat ~/.mcp-gateway/mcp.json
   ```

5. **Test connectivity:**
   ```bash
   ping localhost
   telnet localhost 5000
   ```

6. **Check firewall rules:**
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

   # Linux
   sudo iptables -L
   ```

### Server health shows "down"

**Causes:**
- Server stopped responding
- Server crashed
- Network issue
- Timeout

**Solutions:**

1. **Check if server process is running:**
   ```bash
   ps aux | grep [s]erver-name
   ```

2. **Restart the server:**
   ```bash
   # Depends on your server setup
   pm2 restart my-mcp-server
   # or
   systemctl restart my-mcp-server
   ```

3. **Check server logs for errors:**
   ```bash
   # Depends on your logging setup
   tail -f /var/log/my-mcp-server.log
   ```

4. **Test direct connection:**
   ```bash
   curl -X POST http://localhost:5000 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc": "2.0", "method": "initialize", "id": 1}'
   ```

5. **Increase health check timeout** (if server is slow):
   - Not currently configurable
   - Future enhancement: Make timeout adjustable

### Server health check times out

**Causes:**
- Server response time > 5 seconds
- Network latency
- Server overloaded

**Solutions:**

1. **Check server response time:**
   ```bash
   time curl http://localhost:5000/health
   ```

2. **Optimize server performance:**
   - Check server resource usage
   - Reduce computational load
   - Scale server resources

3. **Check network latency:**
   ```bash
   ping -c 5 <server-host>
   ```

4. **Temporarily disable health checks:**
   - Remove server from gateway
   - Use manual health verification

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

---

## Connection and Proxy Issues

### Requests not being captured in logs

**Causes:**
- Requests not going through gateway
- Wrong endpoint URL
- Session ID mismatch
- Capture disabled

**Solutions:**

1. **Verify you're using gateway proxy URL:**
   ```
   Correct: http://localhost:3333/s/my-server/mcp
   Wrong:   http://localhost:5000/mcp (bypasses gateway)
   ```

2. **Check request headers:**
   ```bash
   curl -v http://localhost:3333/s/my-server/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
   ```

3. **Verify server is registered:**
   ```bash
   curl http://localhost:3333/api/servers
   ```

4. **Check session ID:**
   - Gateway tracks sessions by `X-Session-Id` header
   - Missing header creates new session each time

5. **Enable debug logging:**
   ```bash
   DEBUG=mcp-gateway:* mcp-gateway
   ```

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** Browser security blocking cross-origin requests.

**Solutions:**

1. **Gateway already includes CORS headers** - Check:
   ```bash
   curl -I http://localhost:3333/api/servers
   # Should include: Access-Control-Allow-Origin: *
   ```

2. **If using Web UI, ensure accessing via http://localhost:3333/ui**

3. **For custom integrations, use proxy or disable CORS:**
   ```bash
   # Chrome (dev only, insecure)
   open -na "Google Chrome" --args --disable-web-security --user-data-dir=/tmp/chrome-dev
   ```

4. **Configure reverse proxy to add CORS headers**

### Proxy returns 404 for MCP requests

**Causes:**
- Wrong URL format
- Server name doesn't exist
- Server removed from registry

**Solutions:**

1. **Check URL format:**
   ```
   Correct: http://localhost:3333/s/{server-name}/mcp
   Wrong:   http://localhost:3333/{server-name}/mcp
   ```

2. **List registered servers:**
   ```bash
   curl http://localhost:3333/api/servers
   ```

3. **Add server if missing:**
   ```bash
   curl -X POST http://localhost:3333/api/servers \
     -H "Content-Type: application/json" \
     -d '{"name": "my-server", "url": "http://localhost:5000"}'
   ```

### Proxy returns 502 Bad Gateway

**Cause:** Gateway can't reach upstream MCP server.

**Solutions:**

1. **Check if server is running:**
   ```bash
   curl http://localhost:5000/health
   ```

2. **Verify server URL in config:**
   ```bash
   cat ~/.mcp-gateway/mcp.json
   ```

3. **Test direct connection:**
   ```bash
   curl -X POST http://localhost:5000 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc": "2.0", "method": "initialize", "id": 1}'
   ```

4. **Check network connectivity:**
   ```bash
   ping <server-host>
   telnet <server-host> <port>
   ```

### Requests timeout through gateway

**Causes:**
- Upstream server slow
- Network latency
- Large payloads
- Gateway overloaded

**Solutions:**

1. **Increase client timeout:**
   ```javascript
   fetch(url, { timeout: 30000 })  // 30 seconds
   ```

2. **Check upstream server response time:**
   ```bash
   time curl -X POST http://localhost:5000 \
     -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
   ```

3. **Monitor gateway performance:**
   ```bash
   top -pid $(pgrep mcp-gateway)
   ```

4. **Reduce payload size or request frequency**

---

## Web UI Issues

### Web UI won't load / blank page

**Causes:**
- Gateway not running
- Wrong port
- Browser cache
- JavaScript error

**Solutions:**

1. **Verify gateway is running:**
   ```bash
   curl http://localhost:3333/ui
   # Should return HTML
   ```

2. **Check correct port:**
   - Default: http://localhost:3333/ui
   - Custom: http://localhost:<PORT>/ui

3. **Clear browser cache:**
   - Chrome/Firefox: Ctrl+Shift+Delete
   - Safari: Cmd+Option+E

4. **Check browser console for errors:**
   - Open DevTools (F12)
   - Look for red errors in Console tab

5. **Try different browser:**
   - Rules out browser-specific issues

6. **Check if static files exist:**
   ```bash
   ls -la ~/.mcp-gateway/web/
   ```

### Logs not appearing in Web UI

**Causes:**
- No traffic captured yet
- Filters hiding logs
- Real-time polling disabled
- Database connection issue

**Solutions:**

1. **Send test request through gateway:**
   ```bash
   curl -X POST http://localhost:3333/s/my-server/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
   ```

2. **Clear all filters:**
   - Web UI: Click "Clear Filters" button
   - Check server dropdown is not filtering

3. **Verify logs exist in database:**
   ```bash
   sqlite3 ~/.mcp-gateway/logs.db "SELECT COUNT(*) FROM logs;"
   ```

4. **Check API returns logs:**
   ```bash
   curl http://localhost:3333/api/logs
   ```

5. **Refresh page:**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

6. **Check browser console for errors:**
   - F12 → Console tab
   - Look for network errors

### Web UI is slow or unresponsive

**Causes:**
- Large number of logs (100,000+)
- Complex filters
- Low memory
- Browser performance

**Solutions:**

1. **Clear old logs:**
   ```bash
   curl -X DELETE http://localhost:3333/api/logs
   ```

2. **Use time range filters:**
   - Filter to last hour/day instead of "all time"

3. **Reduce number of displayed logs:**
   - Use pagination
   - Apply more specific filters

4. **Close other browser tabs:**
   - Free up browser memory

5. **Check browser memory usage:**
   - Chrome: Shift+Esc → Task Manager
   - Look for high memory usage

6. **Use API for bulk operations instead:**
   ```bash
   curl http://localhost:3333/api/logs?limit=1000 > logs.json
   ```

### Filters not working in Web UI

**Causes:**
- JavaScript error
- State management bug
- Browser cache

**Solutions:**

1. **Check browser console for errors:**
   - F12 → Console tab

2. **Clear browser cache and reload:**
   - Hard refresh: Ctrl+Shift+R

3. **Try different filter combination:**
   - Use only one filter at a time to isolate issue

4. **Use API to verify expected results:**
   ```bash
   curl "http://localhost:3333/api/logs?server=my-server"
   ```

5. **Report bug with filter details:**
   - [GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues)

### Export not working

**Causes:**
- No logs selected
- Browser popup blocker
- Large dataset timeout

**Solutions:**

1. **Ensure logs are displayed:**
   - Apply filters to see logs first

2. **Check browser popup blocker:**
   - Allow popups for localhost:3333

3. **For large exports, use API:**
   ```bash
   curl http://localhost:3333/api/logs?limit=100000 > logs.json
   ```

4. **Check browser console for errors:**
   - F12 → Console tab

---

## Logs and Data

### How are logs stored?

Logs are stored in SQLite database at `~/.mcp-gateway/logs.db`

**Features:**
- Indexed for fast queries
- WAL mode for concurrent access
- Automatic query optimization

### How long are logs kept?

By default: **Indefinitely**

To clear logs:
- Web UI: Click "Clear Logs" button
- REST API: `curl -X DELETE http://localhost:3333/api/logs`

### How much storage do logs use?

Approximately:
- **1MB per 10,000 MCP exchanges**

Example:
- 100,000 requests ≈ 10MB
- 1,000,000 requests ≈ 100MB

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

### How do I delete logs?

**All logs:**
```bash
curl -X DELETE http://localhost:3333/api/logs
```

Or via Web UI:
- Web UI: Click "Clear Logs"

**Specific logs:**
Not currently supported. Use SQL query if needed:
```bash
sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-7 days');"
```

### My logs disappeared. Can I recover them?

**Recovery options:**
1. Check if using different storage directory
2. Restore from backup if available
3. Recovery via SQLite (advanced, risky)

**Prevention:**
- Regular backups: `cp ~/.mcp-gateway/logs.db backup/`
- Don't delete storage directory accidentally

### Error: "Database disk image is malformed"

**Cause:** SQLite database corruption.

**Solutions:**

1. **Backup current database:**
   ```bash
   cp ~/.mcp-gateway/logs.db ~/.mcp-gateway/logs.db.corrupt
   ```

2. **Try SQLite recovery:**
   ```bash
   sqlite3 ~/.mcp-gateway/logs.db.corrupt ".recover" | sqlite3 ~/.mcp-gateway/logs.db
   ```

3. **If recovery fails, delete and restart:**
   ```bash
   rm ~/.mcp-gateway/logs.db*
   mcp-gateway  # Will create new database
   ```

4. **Prevention:**
   - Regular backups
   - Graceful shutdown (Ctrl+C, not kill -9)
   - Use WAL mode (enabled by default)

### Error: "SQLITE_FULL: database or disk is full"

**Cause:** Insufficient disk space.

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h ~/.mcp-gateway/
   ```

2. **Clear old logs:**
   ```bash
   curl -X DELETE http://localhost:3333/api/logs
   ```

3. **Delete old logs via SQL:**
   ```bash
   sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-30 days');"
   ```

4. **Move storage to larger disk:**
   ```bash
   mcp-gateway --storage /path/to/larger/disk
   ```

5. **Implement log rotation** (manual or cron):
   ```bash
   # Archive and clear monthly
   cp ~/.mcp-gateway/logs.db ./archive/logs-$(date +%Y%m).db
   curl -X DELETE http://localhost:3333/api/logs
   ```

### Can I search across all logs?

Yes, use the search box:
- Case-insensitive
- Partial matching
- Searches multiple fields

Example searches:
- `initialize` - Find all initialization requests
- `error` - Find failed requests
- `my-server` - Find logs from specific server

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

---

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

### Gateway using too much memory

**Causes:**
- Large number of logs in memory
- Memory leak
- Large request/response payloads

**Solutions:**

1. **Check memory usage:**
   ```bash
   # macOS/Linux
   ps aux | grep mcp-gateway

   # Detailed memory info
   top -pid $(pgrep mcp-gateway)
   ```

2. **Clear logs to free memory:**
   ```bash
   curl -X DELETE http://localhost:3333/api/logs
   ```

3. **Restart gateway:**
   ```bash
   pkill mcp-gateway
   mcp-gateway
   ```

4. **Limit log retention:**
   ```bash
   # Delete logs older than 7 days (cron job)
   sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-7 days');"
   ```

5. **Use separate instances for heavy traffic servers:**
   ```bash
   MCP_GATEWAY_PORT=3333 mcp-gateway --storage ~/.mcp-gateway-main
   MCP_GATEWAY_PORT=3334 mcp-gateway --storage ~/.mcp-gateway-heavy
   ```

### Gateway using too much CPU

**Causes:**
- High request rate
- Complex database queries
- Inefficient indexing

**Solutions:**

1. **Monitor CPU usage:**
   ```bash
   top -pid $(pgrep mcp-gateway)
   ```

2. **Check request rate:**
   ```bash
   curl http://localhost:3333/api/logs | jq '.logs | length'
   ```

3. **Optimize database:**
   ```bash
   sqlite3 ~/.mcp-gateway/logs.db "VACUUM;"
   sqlite3 ~/.mcp-gateway/logs.db "REINDEX;"
   ```

4. **Reduce polling frequency in Web UI:**
   - Future enhancement: Configurable polling interval

5. **Scale horizontally** with multiple instances

---

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

---

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

---

## Docker and Deployment

### Can I run gateway in Docker?

Yes, example Dockerfile:

```dockerfile
FROM node:18-alpine
RUN npm install -g @fiberplane/mcp-gateway
EXPOSE 3333
CMD ["mcp-gateway"]
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

---

## Advanced Debugging

### Where do I find error messages?

**Log locations:**
1. Terminal output (if running in foreground)
2. System logs (if running as service)
3. Browser console (if using Web UI - F12)

**Enable debug logging:**
```bash
DEBUG=* mcp-gateway
```

### Enable verbose logging

**All gateway logs:**
```bash
DEBUG=mcp-gateway:* mcp-gateway
```

**Specific modules:**
```bash
DEBUG=mcp-gateway:proxy mcp-gateway    # Proxy only
DEBUG=mcp-gateway:storage mcp-gateway  # Storage only
DEBUG=mcp-gateway:health mcp-gateway   # Health checks only
```

**All debug output:**
```bash
DEBUG=* mcp-gateway  # Very verbose!
```

### Inspect SQLite database directly

**Connect to database:**
```bash
sqlite3 ~/.mcp-gateway/logs.db
```

**Useful queries:**
```sql
-- Count total logs
SELECT COUNT(*) FROM logs;

-- View recent logs
SELECT timestamp, server, method, http_status
FROM logs
ORDER BY timestamp DESC
LIMIT 10;

-- Find errors
SELECT * FROM logs WHERE http_status >= 400;

-- Check database size
SELECT page_count * page_size / 1024 / 1024 AS size_mb
FROM pragma_page_count(), pragma_page_size();

-- List all tables
.tables

-- Show table schema
.schema logs

-- Analyze query performance
EXPLAIN QUERY PLAN SELECT * FROM logs WHERE server = 'my-server';
```

### Test server connectivity

**Basic health check:**
```bash
curl http://localhost:5000/health
```

**Full MCP initialize:**
```bash
curl -X POST http://localhost:5000 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }'
```

**Test through gateway proxy:**
```bash
curl -X POST http://localhost:3333/s/my-server/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

### Network diagnostics

**Check port is listening:**
```bash
# macOS/Linux
netstat -an | grep 3333

# Alternative
lsof -i :3333
```

**Test TCP connection:**
```bash
telnet localhost 3333
# Or
nc -zv localhost 3333
```

**Check DNS resolution:**
```bash
nslookup localhost
host localhost
```

**Trace route:**
```bash
traceroute localhost
```

### Check file permissions

```bash
ls -la ~/.mcp-gateway/
# Should show:
# drwxr-xr-x  (directory readable/writable by owner)
# -rw-r--r--  (files readable by all, writable by owner)
```

Fix permissions if needed:
```bash
chmod 755 ~/.mcp-gateway/
chmod 644 ~/.mcp-gateway/mcp.json
chmod 644 ~/.mcp-gateway/logs.db
```

### Analyze gateway performance

**Monitor in real-time:**
```bash
# CPU and memory
top -pid $(pgrep mcp-gateway)

# Disk I/O
iostat -d 1

# Network
netstat -s
```

**Profile with dtrace (macOS):**
```bash
sudo dtrace -n 'pid$target::*:entry { @[ustack()] = count(); }' -p $(pgrep mcp-gateway)
```

**Profile with perf (Linux):**
```bash
perf record -g -p $(pgrep mcp-gateway)
perf report
```

---

## Contributing and Support

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

### Getting More Help

**Resources:**
- [Getting Started](./getting-started.md) - Installation and first steps
- [CLI Reference](./cli-reference.md) - Command-line usage
- [Web UI Guide](./web-ui-guide.md) - Dashboard features
- [Architecture](../architecture/overview.md) - System design

**Contact:**
- [GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues) - Bug reports
- [GitHub Discussions](https://github.com/fiberplane/mcp-gateway/discussions) - Questions
- [Email](mailto:hello@fiberplane.com) - General inquiries

---

**Didn't find what you're looking for?** Open a [GitHub Discussion](https://github.com/fiberplane/mcp-gateway/discussions) with your question!

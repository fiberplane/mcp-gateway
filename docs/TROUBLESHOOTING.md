# Troubleshooting

Common issues and quick solutions.

## Installation

**Error: "Address already in use"**
```bash
# Kill process on port 3333
lsof -i :3333
kill <PID>

# Or use different port
mcp-gateway --port 3334
```

**Development mode (watch) shutdown issues**
- `bun run --watch` intercepts SIGINT/SIGTERM signals
- May not show shutdown messages/statistics
- Port may not release immediately
- **Solution**: Run without watch or wait ~1s before restart
  ```bash
  # Use regular mode for clean shutdown
  bun run --filter @fiberplane/mcp-gateway dev:no-watch
  ```

**Error: "EACCES: permission denied"**
```bash
chmod 755 ~/.mcp-gateway/
chmod 644 ~/.mcp-gateway/mcp.json
```

**Dependencies missing**
```bash
npm cache clean --force
npm install -g @fiberplane/mcp-gateway
```

## Server Management

**Server health shows "unknown" or "down"**
1. Check server is running: `curl http://localhost:5000/health`
2. Verify server URL in config: `cat ~/.mcp-gateway/mcp.json`
3. Test direct connection: `curl -X POST http://localhost:5000 -d '{"jsonrpc":"2.0","method":"initialize","id":1}'`

**Add server with auth headers**
```bash
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "url": "http://localhost:5000",
    "headers": {"Authorization": "Bearer token123"}
  }'
```

## Stdio Servers

**Stdio server shows "crashed" or "offline"**
1. Check stderr logs in UI for crash details
2. Verify command is executable: `which npx` or `which node`
3. Test command manually: `npx -y @modelcontextprotocol/server-memory`
4. Restart via UI "Restart Process" button or API:
```bash
curl -X POST http://localhost:3333/api/servers/my-server/restart
```

**Stdio server won't start**
```bash
# Check command exists
which node
which npx

# Test command directly
npx -y @modelcontextprotocol/server-memory

# Check permissions
ls -la /path/to/command

# Verify config
cat ~/.mcp-gateway/mcp.json | grep -A 10 "my-server"
```

**Session Modes (Stdio Servers)**

Stdio servers support two session modes:

**Shared Mode (Default)**
- Single subprocess handles all sessions
- Process started eagerly on gateway startup
- Shared state across all clients
- More efficient (lower memory usage)
- Can be restarted via "Restart Process" button

**When to use:** Most use cases, especially stateless servers

**Restart on crash:** Manual restart required via UI or API

**Isolated Mode**
- Separate subprocess per session
- Processes started lazily when first request arrives
- Requires `x-session-id` header in client requests
- Complete isolation between sessions
- Higher memory usage (one process per active session)

**When to use:** When client sessions must not interfere (e.g., testing, multi-tenant)

**Restart on crash:** Cannot manually restart (process bound to session lifecycle)

**Configuration:**
```json
{
  "name": "my-server",
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"],
  "sessionMode": "isolated"
}
```

**Troubleshooting Isolated Mode:**
- Ensure client sends `x-session-id` header
- Check active session count in server details page
- Processes appear with "N sessions" instead of PID

**Stderr logs missing**
- Only last 100 lines kept in memory
- Not persisted to database
- View in UI health banner or via API:
```bash
curl http://localhost:3333/api/servers/my-server | grep stderrLogs
```

**Process State Tracking**

Stdio servers expose detailed process state:

**Status Values:**
- `running` - Process healthy and accepting requests
- `crashed` - Process exited with error (check stderr logs)
- `stopped` - Process terminated gracefully
- `isolated` - Isolated mode (see session count instead)

**Viewing Process State:**
- Server details page shows current status
- Stderr logs show last 100 lines (in-memory, not persisted)
- Error details include exit code and timestamp

**Common Issues:**

**Process shows "crashed" immediately:**
1. Check stderr logs in server details page
2. Test command manually: `npx -y @modelcontextprotocol/server-memory`
3. Verify command exists and has correct permissions
4. Check for missing dependencies or environment variables

**Process keeps restarting:**
- Shared mode: Gateway doesn't auto-restart crashed processes
- Use "Restart Process" button or API to restart manually
- Consider switching to isolated mode for automatic recovery per session

**Stderr logs missing:**
- Only last 100 lines kept (circular buffer)
- Not persisted to database
- Cleared on process restart

## Proxy Issues

**Requests not being captured**
- Use correct URL: `http://localhost:3333/s/{server-name}/mcp`
- Verify server registered: `curl http://localhost:3333/api/servers`
- Enable debug: `DEBUG=mcp-gateway:* mcp-gateway`

**Proxy returns 404**
- Check URL format: `/s/{server-name}/mcp` (not `/{server-name}/mcp`)
- List servers: `curl http://localhost:3333/api/servers`

**Proxy returns 502 Bad Gateway**
- Server not running: `curl http://localhost:5000/health`
- Wrong URL in config: `cat ~/.mcp-gateway/mcp.json`

## Web UI

**Web UI won't load**
```bash
# Verify gateway running
curl http://localhost:3333/ui

# Clear browser cache
Ctrl+Shift+Delete (Chrome/Firefox)
Cmd+Option+E (Safari)

# Check browser console (F12) for errors
```

**Logs not appearing**
```bash
# Send test request
curl -X POST http://localhost:3333/s/my-server/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Verify logs exist
sqlite3 ~/.mcp-gateway/logs.db "SELECT COUNT(*) FROM logs;"

# Check API
curl http://localhost:3333/api/logs
```

**Web UI slow**
```bash
# Clear old logs
curl -X DELETE http://localhost:3333/api/logs

# Or delete logs older than 7 days
sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-7 days');"
```

## Database

**Error: "Database disk image is malformed"**
```bash
# Backup corrupt database
cp ~/.mcp-gateway/logs.db ~/.mcp-gateway/logs.db.corrupt

# Try recovery
sqlite3 ~/.mcp-gateway/logs.db.corrupt ".recover" | sqlite3 ~/.mcp-gateway/logs.db

# If recovery fails, delete and restart
rm ~/.mcp-gateway/logs.db*
mcp-gateway
```

**Error: "SQLITE_FULL: disk is full"**
```bash
# Check disk space
df -h ~/.mcp-gateway/

# Clear logs
curl -X DELETE http://localhost:3333/api/logs

# Or use SQL
sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-30 days');"
```

## Performance

**High memory usage**
```bash
# Check memory
ps aux | grep mcp-gateway

# Clear logs
curl -X DELETE http://localhost:3333/api/logs

# Restart gateway
pkill mcp-gateway && mcp-gateway
```

**High CPU usage**
```bash
# Monitor
top -pid $(pgrep mcp-gateway)

# Optimize database
sqlite3 ~/.mcp-gateway/logs.db "VACUUM; REINDEX;"
```

## Debugging

**Enable debug logging**
```bash
DEBUG=mcp-gateway:* mcp-gateway     # All gateway logs
DEBUG=mcp-gateway:proxy mcp-gateway # Proxy only
DEBUG=* mcp-gateway                 # Very verbose
```

**Inspect database**
```bash
sqlite3 ~/.mcp-gateway/logs.db

# Count logs
SELECT COUNT(*) FROM logs;

# Recent logs
SELECT timestamp, server, method, http_status
FROM logs ORDER BY timestamp DESC LIMIT 10;

# Find errors
SELECT * FROM logs WHERE http_status >= 400;
```

**Test connectivity**
```bash
# Check port listening
lsof -i :3333

# Test TCP connection
nc -zv localhost 3333

# Test through gateway
curl -X POST http://localhost:3333/s/my-server/mcp \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Data Management

**Backup logs**
```bash
cp ~/.mcp-gateway/logs.db ./backup/logs.db
```

**Export logs**
```bash
curl http://localhost:3333/api/logs > logs.json
```

**Clear specific logs**
```bash
# All logs
curl -X DELETE http://localhost:3333/api/logs

# Logs older than 7 days
sqlite3 ~/.mcp-gateway/logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-7 days');"
```

## Security

**Data stored:**
- All MCP request/response messages (including tokens/credentials if sent)
- HTTP headers
- Server configuration
- Session metadata

**Protection:**
```bash
# Restrict file permissions
chmod 700 ~/.mcp-gateway/
chmod 600 ~/.mcp-gateway/logs.db

# Clear logs after debugging
curl -X DELETE http://localhost:3333/api/logs
```

See [SECURITY.md](../SECURITY.md) for production hardening.

## Getting Help

- **Documentation**: [README.md](../README.md)
- **Bug reports**: [GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues)
- **Questions**: [GitHub Discussions](https://github.com/fiberplane/mcp-gateway/discussions)

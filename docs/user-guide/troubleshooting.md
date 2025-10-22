# Troubleshooting Guide

Solutions for common MCP Gateway issues.

## Startup Issues

### Gateway won't start

**Error Message:**
```
Error: Failed to initialize gateway
```

**Causes:**
- Storage directory doesn't exist or isn't writable
- Port is already in use
- Configuration file is invalid
- Required dependencies missing

**Solutions:**

1. **Check storage directory:**
   ```bash
   ls -la ~/.mcp-gateway/
   chmod 700 ~/.mcp-gateway/
   ```

2. **Check if port is available:**
   ```bash
   # macOS/Linux
   lsof -i :3333

   # Windows
   netstat -ano | findstr :3333
   ```

3. **Use different port:**
   ```bash
   MCP_GATEWAY_PORT=3334 mcp-gateway
   ```

4. **Enable debug logging:**
   ```bash
   DEBUG=* mcp-gateway
   ```

### "Port already in use" error

**Error Message:**
```
Error: listen EADDRINUSE :::3333
```

**Solutions:**

1. **Kill process using port:**
   ```bash
   # Find process
   lsof -i :3333

   # Kill it (replace PID)
   kill -9 <PID>
   ```

2. **Use different port:**
   ```bash
   mcp-gateway --port 3334
   ```

3. **Check for zombie processes:**
   ```bash
   ps aux | grep mcp-gateway
   ```

### "Permission denied" error

**Error Message:**
```
Error: EACCES: permission denied, open '~/.mcp-gateway/mcp.json'
```

**Causes:**
- Storage directory owned by different user
- File permissions too restrictive
- Running from wrong directory

**Solutions:**

1. **Fix directory permissions:**
   ```bash
   chmod 700 ~/.mcp-gateway/
   chmod 600 ~/.mcp-gateway/*
   ```

2. **Change ownership:**
   ```bash
   sudo chown -R $USER:$USER ~/.mcp-gateway/
   ```

3. **Create fresh storage directory:**
   ```bash
   rm -rf ~/.mcp-gateway
   mcp-gateway
   ```

## Server Connection Issues

### Server shows "Health: unknown"

**Appearance:**
- Server status is gray circle
- Health check never completes
- No recent activity

**Causes:**
- Server is not running
- URL is incorrect
- Network connectivity issue
- Firewall blocking access
- Server requires authentication

**Solutions:**

1. **Test server directly:**
   ```bash
   curl -v http://localhost:5000
   ```

2. **Check server is running:**
   ```bash
   ps aux | grep <server-name>
   ```

3. **Verify URL is correct:**
   - Remove leading/trailing spaces
   - Use correct hostname (localhost vs 127.0.0.1)
   - Use correct port number
   - Use correct protocol (http vs https)

4. **Check firewall:**
   ```bash
   # macOS
   sudo pfctl -s all | grep "pass"

   # Linux
   sudo iptables -L
   ```

5. **Add custom headers if needed:**
   ```bash
   # Via Web UI: Add server with custom headers
   # Via API:
   curl -X POST http://localhost:3333/api/servers \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-server",
       "url": "http://localhost:5000",
       "headers": {"Authorization": "Bearer token"}
     }'
   ```

### Server shows "Health: down"

**Appearance:**
- Server status is red circle
- Health check fails
- No successful requests

**Causes:**
- Server crashed or stopped
- Server endpoint is wrong
- Server is overloaded
- Network timeout

**Solutions:**

1. **Check server is actually running:**
   ```bash
   curl http://localhost:5000
   ```

2. **Check server logs:**
   ```bash
   # Look for error messages
   tail -f /var/log/my-server.log
   ```

3. **Restart server:**
   ```bash
   systemctl restart my-server
   # or
   docker restart my-server
   ```

4. **Increase health check timeout:**
   - Currently fixed at 5 seconds
   - For slow servers, may need to wait longer
   - Manual refresh: Click "Check Health" button

5. **Check network connectivity:**
   ```bash
   ping localhost:5000
   telnet localhost 5000
   ```

### Requests to server timeout

**Error Message:**
```
Error: Request timeout after 5000ms
```

**Causes:**
- Server is processing slowly
- Server is overloaded
- Network latency
- Server is unresponsive

**Solutions:**

1. **Check server performance:**
   ```bash
   # Measure response time
   time curl http://localhost:5000/health
   ```

2. **Check server resources:**
   ```bash
   # CPU and memory usage
   top -p <server-pid>
   ```

3. **Reduce request load:**
   - Stop other services making requests
   - Wait for server to catch up
   - Restart server

4. **Increase timeout (if supported):**
   - Currently fixed at 5 seconds
   - Future enhancement to make configurable

## Connection and Proxy Issues

### Requests not being captured

**Symptom:**
- Making requests to gateway
- No logs appearing in UI
- No activity in TUI

**Causes:**
- Requests going to server directly instead of gateway
- Wrong gateway URL
- Wrong server name in request path
- Server not responding through gateway

**Solutions:**

1. **Check gateway is running:**
   ```bash
   curl http://localhost:3333/api/servers
   ```

2. **Verify requests go through gateway:**
   - Stop the gateway
   - Try making requests
   - They should fail (proving requests went to gateway before)

3. **Use correct gateway URL:**
   - Web UI: http://localhost:3333/ui
   - REST API: http://localhost:3333/api
   - MCP proxy: http://localhost:3333/mcp/{server-name}

4. **Check server is registered:**
   ```bash
   curl http://localhost:3333/api/servers
   ```

### Requests return errors from gateway

**Error Message:**
```
{
  "error": "Server not found: unknown-server",
  "status": 404
}
```

**Causes:**
- Server not registered in gateway
- Typo in server name
- Server was removed

**Solutions:**

1. **Check registered servers:**
   ```bash
   curl http://localhost:3333/api/servers
   ```

2. **Add server:**
   - Via Web UI: Click "Add Server"
   - Via API: See [CLI Reference](./cli-reference.md)
   - Via TUI: Press `A`

3. **Verify spelling:**
   - Server names are case-sensitive
   - No spaces or special characters
   - Match exactly as registered

### CORS errors in Web UI

**Error Message:**
```
Access to XMLHttpRequest at 'http://localhost:3333/api/servers'
from origin 'http://localhost:3333' has been blocked by CORS policy
```

**Causes:**
- Browser security restriction
- API doesn't support CORS (should work on localhost)
- Using http-only vs https

**Solutions:**

1. **Check API is responding:**
   ```bash
   curl -v http://localhost:3333/api/servers
   ```

2. **Try different browser:**
   - Clear browser cache
   - Try incognito/private mode
   - Try different browser

3. **Disable CORS in development (if needed):**
   - Use browser extension to disable CORS
   - Or access via terminal/API instead of Web UI

## Web UI Issues

### Web UI not loading

**Symptom:**
- Blank page
- "Cannot GET /ui" error
- Page keeps loading

**Causes:**
- Gateway not running
- Web UI not built
- Network issue
- Browser cache issues

**Solutions:**

1. **Check gateway is running:**
   ```bash
   curl http://localhost:3333/ui
   ```

2. **Check console for errors:**
   - Press F12 to open DevTools
   - Go to Console tab
   - Look for red error messages

3. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Develop → Empty Web Caches

4. **Try different browser:**
   - Test in Chrome, Firefox, Safari
   - Rules out browser-specific issues

5. **Check gateway logs:**
   ```bash
   DEBUG=* mcp-gateway
   ```

### Logs not showing in Web UI

**Symptom:**
- Web UI loads
- No logs in activity list
- Server list is empty

**Causes:**
- No servers registered
- No requests made yet
- Logs are filtered out
- Browser not refreshing

**Solutions:**

1. **Add server first:**
   - Click "Add Server" button
   - Enter server name and URL

2. **Make test request:**
   ```bash
   curl -X POST http://localhost:3333/mcp/my-server \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc": "2.0", "id": 1, "method": "initialize"}'
   ```

3. **Check filters:**
   - Click filter button
   - Verify time range includes now
   - Verify server filter includes your server

4. **Refresh browser:**
   - Press F5 or Ctrl+R
   - Check if logs appear

5. **Disable real-time updates temporarily:**
   - Click "Pause" button
   - Manually refresh with button
   - Check if logs show up

### Web UI is slow

**Symptom:**
- Page loads slowly
- Interactions lag
- Typing in search is delayed

**Causes:**
- Too many logs loaded
- Browser running low on memory
- Server is slow to respond
- Network latency

**Solutions:**

1. **Clear old logs:**
   ```bash
   curl -X DELETE http://localhost:3333/api/logs
   ```

2. **Apply time range filter:**
   - Show only last 24 hours
   - Or last hour
   - Reduces data loaded

3. **Close other browser tabs:**
   - Free up memory
   - Can significantly improve performance

4. **Clear browser cache:**
   - Removes old cached data
   - F12 → Application → Cache Storage → Clear

5. **Restart gateway:**
   - Stop gateway with Ctrl+C
   - Start again
   - Fresh memory and state

## Terminal UI Issues

### TUI not responding to keyboard

**Symptom:**
- Pressing keys does nothing
- Cannot navigate menu
- Cursor stuck in one place

**Causes:**
- Terminal focus issue
- Terminal doesn't support input
- TUI process crashed
- Stdin not connected

**Solutions:**

1. **Click terminal window to focus:**
   - Ensure terminal has focus
   - Try clicking in terminal area

2. **Exit and restart:**
   ```bash
   # Press Ctrl+C to exit
   # Then start again
   mcp-gateway
   ```

3. **Try different terminal:**
   - iTerm2, Terminal.app (macOS)
   - GNOME Terminal, Konsole (Linux)
   - PowerShell, Windows Terminal (Windows)

4. **Check stdin is connected:**
   ```bash
   # Interactive mode
   mcp-gateway

   # Not interactive (piped)
   echo "" | mcp-gateway  # Won't work for TUI
   ```

### TUI display is corrupted

**Symptom:**
- Text appears garbled
- Colors are wrong
- Layout is broken

**Causes:**
- Terminal size too small
- Terminal encoding issue
- Terminal doesn't support Unicode
- Font issue

**Solutions:**

1. **Resize terminal:**
   - Make terminal larger
   - TUI needs minimum width/height
   - Try fullscreen

2. **Check terminal encoding:**
   ```bash
   echo $LANG
   # Should show UTF-8
   export LANG=en_US.UTF-8
   ```

3. **Use different terminal:**
   - Try native terminal (Terminal.app, PowerShell)
   - Try tmux or screen

4. **Disable TUI if needed:**
   ```bash
   mcp-gateway --no-tui
   # Use Web UI instead
   ```

## Data and Storage Issues

### "No space left on device" error

**Error Message:**
```
Error: ENOSPC: no space left on device
```

**Causes:**
- Disk is full
- Storage directory is full
- Too many logs stored

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h
   ```

2. **Clear old logs:**
   ```bash
   curl -X DELETE http://localhost:3333/api/logs
   ```

3. **Move storage to larger disk:**
   ```bash
   mcp-gateway --storage /mnt/larger-disk
   ```

4. **Implement log rotation:**
   - Future feature
   - Currently logs kept indefinitely
   - Manually manage storage

### Lost logs after restart

**Symptom:**
- Logs were there yesterday
- After restart, all logs are gone
- Storage directory empty

**Causes:**
- Logs deleted by accident
- Wrong storage directory on restart
- Storage was cleared

**Solutions:**

1. **Check storage directory:**
   ```bash
   ls -la ~/.mcp-gateway/
   ```

2. **Verify you're not using different directory:**
   ```bash
   mcp-gateway --storage ~/.mcp-gateway
   # vs
   mcp-gateway --storage /tmp/mcp-gateway
   ```

3. **Check if logs.db exists:**
   ```bash
   file ~/.mcp-gateway/logs.db
   # Should be SQLite database
   ```

4. **Restore from backup if available:**
   ```bash
   cp backup/logs.db ~/.mcp-gateway/logs.db
   ```

5. **Recovery via SQLite (advanced):**
   ```bash
   sqlite3 ~/.mcp-gateway/logs.db "SELECT COUNT(*) FROM logs;"
   # Check if table exists and has data
   ```

## Performance Issues

### Gateway using too much memory

**Symptom:**
- Memory usage keeps growing
- System becomes slow
- "Out of memory" errors

**Causes:**
- Too many logs stored
- Memory leak in gateway
- Large requests being cached

**Solutions:**

1. **Monitor memory:**
   ```bash
   # macOS/Linux
   ps aux | grep mcp-gateway

   # Get detailed memory stats
   top -p <PID>
   ```

2. **Clear logs:**
   ```bash
   curl -X DELETE http://localhost:3333/api/logs
   ```

3. **Restart gateway:**
   ```bash
   # Stop gateway
   pkill -f mcp-gateway

   # Start fresh
   mcp-gateway
   ```

4. **Limit log retention:**
   - Currently no automatic limit
   - Future feature for log rotation
   - Manually clear periodically

### Gateway CPU usage is high

**Symptom:**
- Gateway taking 50%+ CPU
- System fans running
- Battery draining (laptop)

**Causes:**
- Processing large number of requests
- Health checks running frequently
- Storage queries taking too long

**Solutions:**

1. **Reduce request load:**
   - Stop sending requests
   - Wait for queue to process

2. **Check what's happening:**
   ```bash
   DEBUG=* mcp-gateway
   # Look for high-frequency operations
   ```

3. **Optimize storage:**
   - Clear old logs
   - Use time range filters
   - Restart to reset state

4. **Increase health check interval:**
   - Currently every 30 seconds
   - Future feature to make configurable

## Advanced Debugging

### Enable detailed logging

```bash
DEBUG=* mcp-gateway
# or
DEBUG=@fiberplane/* mcp-gateway
# or specific module
DEBUG=api,capture mcp-gateway
```

### Inspect SQLite database

```bash
sqlite3 ~/.mcp-gateway/logs.db

# List tables
.tables

# Check log count
SELECT COUNT(*) FROM logs;

# View recent logs
SELECT timestamp, method FROM logs ORDER BY timestamp DESC LIMIT 10;

# Export to CSV
.mode csv
.output logs.csv
SELECT * FROM logs;
```

### Test server connectivity

```bash
# Simple connectivity test
curl -v http://localhost:5000

# With custom headers
curl -v -H "Authorization: Bearer token" http://localhost:5000

# Follow redirects
curl -L http://localhost:5000

# Show response headers only
curl -I http://localhost:5000
```

### Check port listening

```bash
# macOS/Linux
lsof -i :3333

# Windows PowerShell
Get-NetTCPConnection -LocalPort 3333

# See all ports
netstat -tulpn | grep LISTEN
```

## Getting Help

If you're still stuck:

1. **Check [FAQ](./faq.md)** - Common questions
2. **Review [Getting Started](./getting-started.md)** - Basic setup
3. **Check [Architecture](../architecture/overview.md)** - How it works
4. **Open GitHub issue** - Report bug with:
   - What you were trying to do
   - What error occurred
   - Steps to reproduce
   - Output of `DEBUG=* mcp-gateway`
   - Your environment (OS, Node version, etc.)

---

**Still need help?** Visit [GitHub Issues](https://github.com/fiberplane/mcp-gateway/issues) or [Discussions](https://github.com/fiberplane/mcp-gateway/discussions)

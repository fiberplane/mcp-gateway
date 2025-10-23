# CLI Reference

Command-line reference for MCP Gateway.

## Basic Commands

### Start Gateway

```bash
mcp-gateway
```

Starts the gateway with default settings:
- Web UI: http://localhost:3333/ui
- REST API: http://localhost:3333/api
- TUI: Terminal UI (interactive)
- Storage: ~/.mcp-gateway/

### View Help

```bash
mcp-gateway --help
```

Displays all available options and commands.

### View Version

```bash
mcp-gateway --version
```

Shows current installed version.

## Options

### Port Configuration

**Option:** `--port <number>`

```bash
mcp-gateway --port 8080
```

Runs gateway on custom port instead of default 3333.

**Environment Variable Alternative:**
```bash
MCP_GATEWAY_PORT=8080 mcp-gateway
```

**Use Cases:**
- Port 3333 already in use
- Running multiple gateway instances
- Testing on different ports

### Storage Location

**Option:** `--storage <path>`

```bash
mcp-gateway --storage /data/mcp-gateway
```

Uses custom directory for storing logs and configuration.

**Default:** `~/.mcp-gateway/`

**Environment Variable Alternative:**
```bash
MCP_GATEWAY_STORAGE=/data/mcp-gateway mcp-gateway
```

**Examples:**
```bash
# Use shared network drive
mcp-gateway --storage /mnt/shared/mcp-gateway

# Use temp directory
mcp-gateway --storage /tmp/mcp-gateway

# Use custom home subdirectory
mcp-gateway --storage ~/.config/mcp-gateway
```

### Disable Terminal UI

**Option:** `--no-tui`

```bash
mcp-gateway --no-tui
```

Starts gateway with only REST API and Web UI (no interactive TUI).

**Use Cases:**
- Running in headless environment
- Docker containers
- Background service
- Automated testing

**Environment Variable Alternative:**
```bash
MCP_GATEWAY_NO_TUI=1 mcp-gateway
```

### Debug Logging

**Option:** `--debug`

```bash
mcp-gateway --debug
```

Enables detailed debug logging from all modules.

**Environment Variable Alternative:**
```bash
DEBUG=* mcp-gateway
```

**Or for specific modules:**
```bash
DEBUG=@fiberplane/* mcp-gateway
DEBUG=registry,capture,api mcp-gateway
```

### Config File

**Option:** `--config <path>`

```bash
mcp-gateway --config /etc/mcp-gateway/config.json
```

Load configuration from file instead of environment variables.

**Config File Format:**
```json
{
  "port": 3333,
  "storage": "~/.mcp-gateway",
  "tui": true,
  "debug": false,
  "servers": [
    {
      "name": "my-server",
      "url": "http://localhost:5000"
    }
  ]
}
```

## Terminal UI Commands

When running with TUI enabled, use these keyboard shortcuts:

### Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list items |
| `←` / `→` | Navigate between sections |
| `Tab` | Move to next section |
| `Shift+Tab` | Move to previous section |
| `Page Up` / `Page Down` | Scroll pages |
| `Home` / `End` | Jump to start/end |

### Operations

| Key | Action |
|-----|--------|
| `A` | Add new server |
| `R` | Remove selected server |
| `E` | Edit selected server |
| `H` | Show health status |
| `L` | View activity logs |
| `C` | Clear all logs |
| `S` | Server settings |
| `/` | Search/filter |
| `?` | Show help |
| `Q` | Quit gateway |

### Modal Navigation

| Key | Action |
|-----|--------|
| `Enter` | Confirm action |
| `Escape` | Cancel/close modal |
| `Tab` | Next field |
| `Shift+Tab` | Previous field |

## REST API Examples

### Query Servers

```bash
curl http://localhost:3333/api/servers
```

Returns list of registered servers with health status:

```json
{
  "servers": [
    {
      "name": "my-server",
      "url": "http://localhost:5000",
      "health": "up",
      "lastActivity": "2024-10-22T10:30:00Z",
      "exchangeCount": 42
    }
  ]
}
```

### Add Server

```bash
curl -X POST http://localhost:3333/api/servers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-server",
    "url": "http://localhost:5000"
  }'
```

### Remove Server

```bash
curl -X DELETE http://localhost:3333/api/servers/my-server
```

### Query Logs

```bash
curl "http://localhost:3333/api/logs?server=my-server&limit=100"
```

**Query Parameters:**
- `server`: Filter by server name
- `since`: Filter by date (ISO 8601)
- `until`: Filter by date (ISO 8601)
- `method`: Filter by MCP method
- `limit`: Number of results (default: 100)
- `offset`: Pagination offset (default: 0)

### Clear Logs

```bash
curl -X DELETE http://localhost:3333/api/logs
```

## Environment Variables

### Gateway Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `MCP_GATEWAY_PORT` | Server port | `3333` |
| `MCP_GATEWAY_STORAGE` | Storage directory | `~/.mcp-gateway` |
| `MCP_GATEWAY_NO_TUI` | Disable TUI | `1` |
| `DEBUG` | Debug logging | `*` or `@fiberplane/*` |

### Combined Example

```bash
DEBUG=* \
MCP_GATEWAY_PORT=8080 \
MCP_GATEWAY_STORAGE=/data/mcp \
mcp-gateway --no-tui
```

## Common Use Cases

### Development Setup

Start with debug logging and custom port:

```bash
DEBUG=* MCP_GATEWAY_PORT=3334 mcp-gateway
```

### Docker Container

Run headless without TUI:

```bash
mcp-gateway --no-tui --storage /data/mcp-gateway
```

### Multiple Instances

Run two gateways on different ports:

```bash
# Terminal 1
MCP_GATEWAY_PORT=3333 mcp-gateway

# Terminal 2
MCP_GATEWAY_PORT=3334 mcp-gateway
```

### Automated Testing

Run gateway in background with custom storage:

```bash
MCP_GATEWAY_STORAGE=/tmp/test-mcp \
MCP_GATEWAY_NO_TUI=1 \
mcp-gateway &
GATEWAY_PID=$!

# Run tests...

kill $GATEWAY_PID
```

### Production Deployment

With external reverse proxy:

```bash
MCP_GATEWAY_STORAGE=/var/lib/mcp-gateway \
MCP_GATEWAY_PORT=3333 \
DEBUG=* \
mcp-gateway --no-tui
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Clean shutdown |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | Port already in use |
| `4` | Storage directory error |
| `130` | Interrupted by user (Ctrl+C) |

## Signals

The gateway responds to these signals:

| Signal | Action |
|--------|--------|
| `SIGTERM` | Graceful shutdown (flush logs, close connections) |
| `SIGINT` | Graceful shutdown (Ctrl+C) |
| `SIGHUP` | Reload configuration (if applicable) |

## Output

### Startup Output

```
✨ MCP Gateway starting...

🌐 Web UI:      http://localhost:3333/ui
📡 REST API:    http://localhost:3333/api
🖥️  Terminal UI:  Ready (use keyboard shortcuts below)

Available commands:
  [A]dd server      [R]emove server    [C]lear logs
  [?]Help           [Q]uit
```

### Log Format

With debug enabled, logs include:

```
[2024-10-22T10:30:00Z] [INFO] [registry] Server registered: my-server
[2024-10-22T10:30:01Z] [DEBUG] [api] Received GET /servers
[2024-10-22T10:30:02Z] [WARN] [health] Health check timeout for server: my-server
[2024-10-22T10:30:03Z] [ERROR] [capture] Failed to write log: ENOSPC
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3333
lsof -i :3333

# Use different port
mcp-gateway --port 3334
```

### Permission Denied on Storage

```bash
# Check permissions
ls -la ~/.mcp-gateway/

# Fix permissions
chmod 700 ~/.mcp-gateway
chmod 600 ~/.mcp-gateway/*
```

### Gateway Won't Start

```bash
# Enable debug logging
DEBUG=* mcp-gateway

# Check error messages in output
# Verify storage directory exists and is writable
# Check if another instance is already running
```

### Memory Usage Too High

```bash
# Clear old logs
curl -X DELETE http://localhost:3333/api/logs

# Or clear and restart
mcp-gateway --storage /tmp/fresh-mcp
```

## Advanced Configuration

### systemd Service

Create `/etc/systemd/system/mcp-gateway.service`:

```ini
[Unit]
Description=MCP Gateway
After=network.target

[Service]
Type=simple
User=mcp-gateway
WorkingDirectory=/home/mcp-gateway
ExecStart=/usr/local/bin/mcp-gateway --no-tui
Restart=on-failure
RestartSec=10

Environment="MCP_GATEWAY_STORAGE=/var/lib/mcp-gateway"
Environment="DEBUG=@fiberplane/*"

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl enable mcp-gateway
systemctl start mcp-gateway
systemctl status mcp-gateway
```

### Docker

Dockerfile:

```dockerfile
FROM node:18-alpine

RUN npm install -g @fiberplane/mcp-gateway

EXPOSE 3333

CMD ["mcp-gateway", "--no-tui"]
```

Build and run:

```bash
docker build -t mcp-gateway .
docker run -d -p 3333:3333 \
  -e MCP_GATEWAY_STORAGE=/data \
  -v mcp-data:/data \
  mcp-gateway
```

## Scripts and Automation

### Health Check

```bash
#!/bin/bash

if curl -s http://localhost:3333/api/servers > /dev/null; then
  echo "Gateway is healthy"
  exit 0
else
  echo "Gateway is down"
  exit 1
fi
```

### Backup Logs

```bash
#!/bin/bash

BACKUP_DIR="./backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

curl http://localhost:3333/api/logs > "$BACKUP_DIR/logs.json"
cp ~/.mcp-gateway/mcp.json "$BACKUP_DIR/"

echo "Backed up to $BACKUP_DIR"
```

### Monitor and Alert

```bash
#!/bin/bash

while true; do
  # Check each server's health
  curl -s http://localhost:3333/api/servers | jq '.servers[] | select(.health == "down")'

  # If any are down, send alert
  if [ $? -eq 0 ]; then
    echo "Alert: Server down!" | mail -s "MCP Gateway Alert" admin@example.com
  fi

  sleep 60
done
```

---

**Related Documentation:**
- [Getting Started](./getting-started.md) - Installation and first steps
- [Web UI Guide](./web-ui-guide.md) - Dashboard usage
- [Troubleshooting](./troubleshooting.md) - Common issues

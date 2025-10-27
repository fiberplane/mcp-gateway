# Web UI Guide

The MCP Gateway Web UI provides an intuitive dashboard for managing MCP servers and browsing captured logs. Access it at `http://localhost:3333/ui` when the gateway is running.

## Dashboard Overview

The main dashboard shows:

- **Server List** - All registered MCP servers with health status
- **Quick Stats** - Total requests, errors, and last activity
- **Activity Log** - Real-time stream of captured MCP traffic
- **Search & Filter** - Find specific logs by criteria

## Managing Servers

### Adding a Server

1. Click the **"+ Add Server"** button in the top-right corner
2. Enter server details:
   - **Name**: Unique identifier (e.g., "my-server", "claude-tools")
   - **URL**: Server endpoint (e.g., "http://localhost:5000")
   - **Headers** (optional): Custom headers for requests
3. Click **"Add"**
4. Gateway performs health check and displays status

**Example:**
```
Name: claude-tools
URL: http://localhost:8000
Headers: Authorization: Bearer token123
```

### Monitoring Server Health

Each server card shows:

- **Status Indicator**: Green (up), red (down), gray (unknown)
- **Last Activity**: Timestamp of most recent request
- **Request Count**: Total requests since registration
- **Last Health Check**: When health was last verified

Click on a server to see detailed metrics:
- Average response time
- Error rate
- Request history
- Recent logs

### Removing a Server

1. Click on the server card or entry
2. Click **"Remove Server"**
3. Confirm deletion
4. **Note**: Logs are preserved; only the server registration is removed

## Viewing Logs

### Log List

The main log view shows a table with columns:

| Column | Description |
|--------|-------------|
| **Time** | Request timestamp (relative or absolute) |
| **Server** | Which server handled the request |
| **Method** | MCP method name (e.g., "initialize", "list_resources") |
| **Method Detail** | Human-readable preview of the request/response (e.g., tool arguments, response preview) |
| **Status** | HTTP status (200, 500, etc.) or error |
| **Duration** | Response time in milliseconds |
| **Tokens** | Estimated token count (input + output) for cost tracking - hover for breakdown |
| **Actions** | View details or export |

**Note on Token Estimates**: Token counts use a ~4 characters per token heuristic for approximate cost tracking. These are estimates (±10-20% variance) and should not be used for exact billing. For precise token counts, use your LLM provider's tokenizer.

### Viewing Log Details

Click on any log entry to expand and view:

- **Request JSON**: Full request payload
- **Response JSON**: Full response payload
- **Headers**: HTTP request/response headers
- **Session Info**: Client and server identification
- **Error Details**: Full error message and stack trace (if applicable)

### Filtering Logs

#### By Server

Click the **"Filter by Server"** dropdown to:
- Show all servers
- Select specific server
- Results update automatically

#### By Time Range

Use the **"Date Range"** picker:

**Quick Options:**
- Last hour
- Last 24 hours
- Last 7 days
- Custom range (select start and end dates)

**Example:**
```
Show logs from: 2024-10-22
To: 2024-10-23
For server: claude-tools
```

#### By Method

Type in the **"Method Filter"** to find specific MCP methods:

- `initialize` - Server initialization
- `list_resources` - List available resources
- `read_resource` - Read a resource
- `call_tool` - Execute a tool
- `list_tools` - List available tools

### Searching Logs

Use the **"Search"** bar to find logs by:

- **Server name**: "my-server"
- **Method name**: "call_tool"
- **Error messages**: "timeout"
- **Session ID**: "sess-abc123"

Search is **case-insensitive** and matches partial text.

### Exporting Logs

#### Export Single Log

1. Expand a log entry
2. Click **"Export"** or **"Copy JSON"**
3. Choose format:
   - **JSON**: Full structured data
   - **CSV**: Tabular format
   - **Text**: Human-readable format

#### Export Filtered Logs

1. Apply filters (server, time range, etc.)
2. Click **"Export All"** button
3. Choose format and download

**CSV Format Example:**
```csv
timestamp,server,method,status,duration_ms
2024-10-22T10:30:00Z,my-server,initialize,200,45
2024-10-22T10:30:01Z,my-server,list_resources,200,78
```

## Advanced Features

### Real-Time Updates

The Web UI automatically refreshes logs every 2-5 seconds. To **pause updates**:

1. Click **"Pause"** button at top-right
2. Browse logs without interruption
3. Click **"Resume"** to continue live updates

### Server Metrics

Click a server card to see detailed metrics:

- **Uptime**: Percentage of time server was healthy
- **Request Trend**: Graph of requests over time
- **Error Rate**: Percentage of failed requests
- **Response Time**: Average and percentile latencies
- **Top Methods**: Most frequently called methods

### Session Tracking

View complete request/response sessions:

1. Filter to specific time range
2. Logs grouped by session
3. Expand session to see all related logs
4. Trace request flow between client and server

### Sorting and Ordering

Click column headers to sort:

| Column | Sort Options |
|--------|------|
| **Time** | Newest first, oldest first |
| **Server** | A-Z, Z-A |
| **Method** | A-Z, Z-A |
| **Duration** | Fastest first, slowest first |
| **Status** | Success first, errors first |
| **Tokens** | Highest first, lowest first (empty values at end) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `Cmd+K` | Open command palette |
| `Ctrl+F` or `Cmd+F` | Focus search box |
| `Ctrl+L` or `Cmd+L` | Clear filters |
| `Escape` | Close modals or expanded logs |
| `/` | Focus search box |
| `?` | Show help |

## Common Tasks

### Find Failed Requests

1. Apply filter for time range when error occurred
2. Click "Status" column header to sort by error
3. Errors appear at top or bottom (depending on sort)
4. Click to view full error details

### Compare Two Requests

1. Expand first log entry (pin it if available)
2. Open second log entry in new browser tab
3. Compare request/response side-by-side

### Monitor Server Health Over Time

1. Go to server details page
2. Review the "Uptime" graph
3. Click on spike in graph to view problematic requests
4. Identify patterns in failures

### Track Specific Method Usage

1. Filter by method (e.g., "call_tool")
2. View all requests for that method
3. See which parameters are used in the **Method Detail** column
4. Analyze response patterns and token costs

### Identify Expensive Tool Calls

1. Click the **Tokens** column header to sort by token count
2. High token count calls appear at the top
3. Review these for optimization opportunities
4. Check if responses could be more concise

## Troubleshooting

### No logs appearing

**Causes:**
- Gateway is not receiving requests
- Wrong server name in filter
- Filter time range doesn't match actual requests

**Solutions:**
1. Check that gateway is running: `curl http://localhost:3333/api/servers`
2. Verify requests are actually going to gateway URL
3. Clear filters and try again
4. Check server health status

### Server shows "Health: unknown"

**Causes:**
- Server was just added (health check in progress)
- Server is not responding
- Network connectivity issue

**Solutions:**
1. Wait 5-10 seconds for initial health check
2. Click "Check Health" button manually
3. Verify server URL is correct and reachable
4. Check firewall and network settings

### Logs not updating in real-time

**Causes:**
- Real-time updates are paused
- Browser tab is backgrounded
- API is slow to respond

**Solutions:**
1. Click "Resume" button if paused
2. Bring browser tab to foreground
3. Manually refresh with browser refresh button
4. Check gateway performance

### Exporting logs fails

**Causes:**
- Large number of logs selected
- Browser memory limitation
- API timeout

**Solutions:**
1. Reduce filter scope (smaller time range)
2. Export in smaller batches
3. Try different export format
4. Use REST API for large exports

## Display Requirements

The Web UI is designed for desktop browsers:
- **Minimum Resolution**: 1280x720 (HD)
- **Recommended**: 1920x1080 (Full HD) or higher
- **Wide screens**: Better experience with more visible columns

**Note**: While the UI may be usable on larger tablets in landscape mode, mobile devices are not officially supported. Some responsive elements exist but full mobile optimization is not implemented.

## Accessibility

The Web UI follows WCAG 2.1 AA standards:

- Keyboard navigation supported
- Screen reader friendly
- High contrast mode supported
- Focus indicators visible
- Semantic HTML structure

**Screen Reader Tips:**
- Headings: Use `H` key to navigate sections
- Tables: Use arrow keys to navigate cells
- Buttons: Use `Tab` to focus, `Enter` to activate
- Links: Use `Tab` to navigate, `Enter` to follow

## Browser Support

The Web UI aims to work with the latest versions of major desktop browsers:

- Chrome/Edge
- Firefox
- Safari

**Note**: The UI is designed for desktop browsers. While it may be usable on larger tablets in landscape mode, mobile devices are not officially supported. Cross-browser testing is not comprehensive, so your mileage may vary with older browser versions.

## Performance

The Web UI is optimized for:

- **Loading**: ~1-2 seconds initial load
- **Responsiveness**: <200ms interaction latency
- **Scalability**: Handles 10,000+ logs efficiently

**Performance Tips:**
- Close old browser tabs to free memory
- Clear browser cache periodically
- Use time range filters to reduce data
- Disable real-time updates if not needed

## Integration with Terminal UI

If using the Terminal UI alongside Web UI:

- Both share the same data (logs and servers)
- Changes in TUI appear in Web UI (with slight delay)
- Changes in Web UI appear in TUI instantly
- Both can filter and manage servers independently

## Preferences

Settings are stored in browser localStorage:

- **Theme**: Light or dark mode (if available)
- **Time Format**: 12/24 hour format
- **Sort Order**: Remember last sort preferences
- **Filters**: Remember last used filters

**To Reset:**
1. Open browser DevTools (F12)
2. Go to Application → LocalStorage
3. Find `mcp-gateway-ui`
4. Clear or edit values

## Help and Support

For issues or questions:

1. Check browser console for errors (F12 → Console)
2. Review [Troubleshooting](./troubleshooting.md) guide
3. Check [FAQ](./faq.md) for common questions
4. Open GitHub issue with:
   - Browser version
   - Steps to reproduce
   - Screenshots or error messages

---

**Next Steps:**
- [CLI Reference](./cli-reference.md) - Command-line usage
- [Troubleshooting](./troubleshooting.md) - Common issues
- [Architecture](../architecture/overview.md) - How it works

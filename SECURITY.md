# Security

## Security Model

MCP Gateway is designed to operate as a **local development and debugging tool** with the following security model:

### Default Configuration

- **Network**: Listens on `localhost:3333` by default
- **Access**: Local machine access only (no authentication required for localhost)
- **Storage**: All data stored in user's home directory (`~/.mcp-gateway/`)
- **Data**: No sensitive data encryption at rest (design choice for dev tool)

### Deployment Contexts

#### Development (Default)
- Gateway runs on local machine
- Used for debugging MCP integrations
- No network exposure
- No authentication required

#### Testing
- Standalone test environments
- Controlled access
- Use separate credentials for testing

#### Production
Not recommended without significant security hardening:
- Requires network isolation
- Should run in container with restricted permissions
- Consider reverse proxy with authentication
- See production hardening recommendations below

## Data Privacy

### What Data is Stored

MCP Gateway captures and stores:

1. **Request/Response Logs**
   - All MCP protocol messages
   - Request parameters and response results
   - HTTP headers and status codes
   - Timestamps and duration metrics

2. **Server Configuration**
   - Server names and URLs
   - Custom headers (if any)
   - Health check status

3. **Session Metadata**
   - Client information (name, version)
   - Server information (capabilities, version)
   - Session identifiers

### What Data is NOT Stored

- **Credentials**: OAuth tokens, API keys, passwords are NOT persisted
- **Sensitive Parameters**: PII or secret data in MCP messages are captured as-is but not specially protected

### Storage Location

```
~/.mcp-gateway/
├── mcp.json              # Server registry
├── logs.db              # SQLite database with captured traffic
└── logs.db-*            # Database journal files
```

Default permissions: `700` (user read/write/execute only)

### Data Retention

- **Default**: Logs retained indefinitely
- **Manual**: Use web UI or CLI to clear logs
- **Programmatic**: REST API provides clearAll() endpoint

**Recommendation**: Implement log rotation in production deployments

## OAuth Token Handling

MCP servers may require OAuth authentication:

### Token Flow

1. MCP client obtains OAuth token from server
2. Token is included in MCP messages to gateway
3. Gateway forwards token to MCP server
4. Response includes any updated tokens

### Security Considerations

- **Not Persisted**: OAuth tokens are captured in logs but not separately encrypted
- **Log Access**: Anyone with file system access to `~/.mcp-gateway/` can read tokens
- **Sensitive Data**: Treat captured logs as sensitive

### Best Practices

1. **Restrict File Permissions**
   ```bash
   chmod 700 ~/.mcp-gateway/
   ```

2. **Use Separate Service Account**
   - Run gateway with dedicated user account
   - Restrict file access to that user

3. **Limit Log Retention**
   - Periodically clear logs
   - Implement log rotation in production

4. **Network Isolation**
   - Keep gateway on localhost only
   - Use firewall rules if network exposure needed

5. **Avoid Sensitive Data in Tests**
   - Don't test with production tokens
   - Use separate staging credentials

## Network Security

### Default Configuration

```
Gateway Server
├── Web UI: http://localhost:3333/ui
├── REST API: http://localhost:3333/api
├── Gateway MCP Server: http://localhost:3333/gateway/mcp
├── Proxy Endpoints: http://localhost:3333/s/{server-name}/mcp
└── Outbound: Connects to configured MCP servers
```

### Localhost Only

- **No Authentication**: Assumes local network access is trusted
- **No Encryption**: HTTP only (localhost)
- **No Authorization**: All endpoints fully accessible

### Production Considerations

For production deployments:

1. **Reverse Proxy**
   - Use nginx/Caddy for TLS termination
   - Add authentication (Basic Auth, OAuth)
   - Implement rate limiting

2. **Network Isolation**
   - Run in isolated VPC/network
   - Use firewall rules
   - Restrict outbound connections

3. **TLS/SSL**
   - Terminate TLS at reverse proxy
   - Use valid certificates
   - Enforce HTTPS

4. **Authentication**
   - Implement access control
   - Use bearer tokens or OAuth
   - Protect API endpoints

## Server Communication

### Outbound Connections

Gateway connects to configured MCP servers:
- **Addresses**: Whatever URLs are configured
- **Authentication**: Delegated to each server
- **Data**: Captures all traffic for logging

### Security Implications

1. **MCP Server Compromise**
   - Gateway will proxy traffic to compromised servers
   - Logs will contain any malicious responses

2. **MITM Attacks**
   - Uses HTTP by default
   - Vulnerable to man-in-the-middle
   - Production deployments should enforce HTTPS

3. **Server Discovery**
   - Only configured servers are contacted
   - New servers require explicit registration
   - No automatic server discovery

## File System Permissions

### Default Behavior

```bash
~/.mcp-gateway/
drwx------  .          # 700: User only
-rw-------  mcp.json   # 600: User read/write
-rw-------  logs.db    # 600: User read/write
```

### Hardening

1. **Verify Permissions**
   ```bash
   ls -ld ~/.mcp-gateway/
   stat ~/.mcp-gateway/
   ```

2. **Restrict Further** (if needed)
   ```bash
   chmod 700 ~/.mcp-gateway/
   chmod 600 ~/.mcp-gateway/mcp.json
   chmod 600 ~/.mcp-gateway/logs.db
   ```

3. **Use Separate Account**
   ```bash
   useradd mcp-gateway
   chown -R mcp-gateway:mcp-gateway ~/.mcp-gateway/
   ```

4. **SELinux/AppArmor**
   - Configure policies for production
   - Restrict file access
   - Limit network access

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT open a public GitHub issue**
2. **Email**: security@fiberplane.com (or appropriate contact)
3. **Include**: Description, steps to reproduce, impact assessment
4. **Response**: We aim to respond within 48 hours

### Security Update Process

1. Vulnerability confirmed and assessed
2. Fix developed and tested
3. Security advisory issued
4. Fixed version released
5. Notification sent to users

## Audit Logging

Current Limitations:
- Gateway does not have built-in audit logging
- All MCP traffic is captured in logs
- No separate security event logging

### Recommendations for Production

1. Enable OS-level audit logging
2. Monitor file system changes to `~/.mcp-gateway/`
3. Track gateway process activity
4. Monitor network connections
5. Implement centralized log aggregation

## Third-Party Dependencies

### Dependency Scanning

- Regular dependency updates
- Security scanning via CI/CD
- Vulnerability monitoring via npm

### Key Dependencies

See `package.json` for complete dependency list. Key security-relevant packages:
- **bun**: JavaScript runtime
- **hono**: Web framework
- **drizzle-orm**: Database ORM
- **sqlite**: Database engine

Monitor security advisories for these packages.

## Best Practices

### For Development

1. ✅ Use localhost only
2. ✅ Clear sensitive logs after debugging
3. ✅ Use separate credentials for testing
4. ✅ Don't commit `.mcp-gateway/` directory
5. ✅ Review logs before sharing

### For Testing

1. ✅ Use isolated test environment
2. ✅ Use test credentials
3. ✅ Clean up after tests
4. ✅ Don't store sensitive data

### For Production

1. ✅ Run in isolated network
2. ✅ Use reverse proxy with TLS
3. ✅ Implement authentication
4. ✅ Restrict file permissions
5. ✅ Monitor and audit access
6. ✅ Implement log rotation
7. ✅ Use separate service account
8. ✅ Regular security updates

## Known Limitations

⚠️ **NOT Recommended for Production Use** without significant hardening:

1. **No Built-in Authentication**
   - Relies on network isolation
   - No access control

2. **No Encryption at Rest**
   - Logs stored unencrypted
   - OAuth tokens in plain text

3. **No Audit Logging**
   - No tracking of who accessed what
   - Limited operational visibility

4. **No Rate Limiting**
   - Vulnerable to DoS attacks
   - No request throttling

5. **HTTP Only**
   - No TLS encryption
   - Man-in-the-middle vulnerable

6. **No Secret Management**
   - Credentials stored in config files
   - No encryption of sensitive values

## Roadmap

Potential security enhancements:

- [ ] Built-in TLS support
- [ ] API authentication (OAuth2, API keys)
- [ ] Encrypted storage at rest
- [ ] Audit logging
- [ ] Rate limiting and DDoS protection
- [ ] Secret management integration
- [ ] Role-based access control
- [ ] Secrets redaction in logs

## Support

For security questions or concerns:
- Email: security@fiberplane.com
- GitHub Issues: [Not for vulnerabilities]
- Discussions: [General security questions]

---

**Related Documentation**:
- [README](./README.md) - User guide
- [AGENTS.md](./AGENTS.md) - Development guide
- [TROUBLESHOOTING](./docs/TROUBLESHOOTING.md) - Common issues

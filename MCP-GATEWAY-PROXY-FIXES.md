# MCP Gateway Proxy Fixes - Implementation Plan

## Overview

This document outlines a detailed plan to fix three critical issues in the MCP Gateway proxy implementation:

1. **Missing GET /mcp route support** - For SSE streaming responses
2. **Missing DELETE /mcp route support** - For session cleanup
3. **Incorrect 401 response handling** - Should be proxied transparently with auth info

## Current State Analysis

### What Works Currently

The gateway currently implements:
- **POST /servers/:server/mcp** - Full JSON-RPC proxy with SSE support (lines 244-434 in `server.ts`)
- **POST /s/:server/mcp** - Short alias for POST proxy (lines 437-627 in `server.ts`)
- **SSE streaming** - Already handles SSE responses from POST requests correctly (lines 299-330)
- **Capture system** - Records all requests/responses to JSONL files
- **Session management** - Tracks sessions via `Mcp-Session-Id` header

### What's Missing

1. **No GET route handlers** for `/servers/:server/mcp` and `/s/:server/mcp`
2. **No DELETE route handlers** for `/servers/:server/mcp` and `/s/:server/mcp`
3. **401 responses are caught and wrapped** in JSON-RPC errors instead of being proxied transparently

### Gateway's Own MCP Server (Reference Implementation)

The gateway's internal MCP server at `/gateway/mcp` (lines 113-138 in `mcp-server.ts`) uses:
```typescript
app.all("/mcp", async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});
```

This uses `StreamableHttpTransport` from `mcp-lite` which handles:
- **GET** - Returns SSE stream for long-running operations
- **POST** - Handles JSON-RPC requests
- **DELETE** - Removes sessions (based on MCP HTTP transport spec)

## Problem 1: Missing GET /mcp Support

### Issue Description

The Model Context Protocol HTTP transport specification supports GET requests that return Server-Sent Events (SSE) streams. This is used for:
- Long-running tool executions that stream progress updates
- Real-time notifications from MCP servers
- Streaming responses that don't fit in a single JSON-RPC response

### Expected Behavior

When a client sends:
```http
GET /servers/my-server/mcp HTTP/1.1
Accept: text/event-stream
Mcp-Session-Id: session-123
MCP-Protocol-Version: 2025-06-18
```

The gateway should:
1. Validate the session header
2. Forward the GET request to the target MCP server
3. Stream the SSE response back to the client
4. Capture SSE events to the session's JSONL file
5. Update server activity metrics
6. Log events to the TUI

### Proposed Implementation

#### Location
Add two new route handlers in `server.ts`:
- `app.get("/servers/:server/mcp", ...)`
- `app.get("/s/:server/mcp", ...)`

#### Handler Logic

```typescript
app.get(
  "/servers/:server/mcp",
  sValidator("param", serverParamSchema),
  sValidator("header", sessionHeaderSchema),
  async (c) => {
    const startTime = Date.now();
    
    // Get validated data
    const { server: serverName } = c.req.valid("param");
    
    // Find server in registry
    const server = getServer(registry, serverName);
    if (!server) {
      return c.notFound();
    }
    
    // Extract session ID from headers
    const validatedHeaders = c.req.valid("header");
    const sessionId = extractSessionId(validatedHeaders);
    
    // Build proxy headers (without Content-Type: application/json for GET)
    const proxyHeaders = buildProxyHeadersForGet(c, server);
    
    try {
      // Forward GET request to target MCP server
      const targetResponse = await proxy(server.url, {
        method: "GET",
        headers: proxyHeaders,
      });
      
      const httpStatus = targetResponse.status;
      
      // IMPORTANT: Check for 401 early and return as-is
      if (httpStatus === 401) {
        return new Response(targetResponse.body, {
          status: 401,
          headers: targetResponse.headers,
        });
      }
      
      // Check if response is SSE stream
      const contentType = targetResponse.headers.get("content-type")?.toLowerCase() || "";
      const isSSE = contentType.startsWith("text/event-stream");
      
      if (isSSE) {
        // Update server activity immediately for SSE
        await updateServerActivity(storage, registry, server);
        
        if (!targetResponse.body) {
          throw new Error("SSE response has no body");
        }
        
        // Create two streams from the response body
        const [streamForClient, streamForCapture] = targetResponse.body.tee();
        
        // Start background capture processing
        processSSECapture(
          streamForCapture,
          storage,
          server,
          sessionId,
          "GET /mcp", // method for logging
          null, // no request ID for GET
        );
        
        // Log the GET request
        logGetRequest(server, sessionId);
        
        // Return streaming response to client
        return new Response(streamForClient, {
          status: httpStatus,
          headers: targetResponse.headers,
        });
      }
      
      // Handle non-SSE responses (shouldn't happen normally but be defensive)
      const responseText = await targetResponse.text();
      await updateServerActivity(storage, registry, server);
      
      return new Response(responseText, {
        status: httpStatus,
        headers: targetResponse.headers,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      logError(server, sessionId, "GET /mcp", httpStatus, duration, error);
      
      // Return error response (not JSON-RPC format for GET)
      return c.json(
        { error: String(error) },
        500
      );
    }
  }
);
```

#### Helper Functions to Add

```typescript
// Build proxy headers for GET requests (no Content-Type: application/json)
function buildProxyHeadersForGet(
  c: Context,
  server: McpServer,
): Record<string, string> {
  const proxyHeaders: Record<string, string> = {
    "MCP-Protocol-Version":
      c.req.raw.headers.get("MCP-Protocol-Version") || "2025-06-18",
    "Mcp-Session-Id":
      c.req.raw.headers.get("Mcp-Session-Id") ||
      c.req.raw.headers.get("mcp-session-id") ||
      "",
    ...Object.fromEntries(
      Object.entries(server.headers).filter(
        ([key]) => !AUTO_HEADERS.includes(key.toLowerCase()),
      ),
    ),
  };
  
  // Forward Accept header for SSE
  const acceptHeader = c.req.raw.headers.get("Accept");
  if (acceptHeader) {
    proxyHeaders.Accept = acceptHeader;
  }
  
  return proxyHeaders;
}

// Log GET request (without JSON-RPC structure)
function logGetRequest(
  server: McpServer,
  sessionId: string,
): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    sessionId,
    method: "GET /mcp",
    httpStatus: 0,
    duration: 0,
    direction: "request",
  };
  
  emitLog(logEntry);
}
```

#### Capture Considerations

- GET requests don't have a JSON-RPC body, so we won't capture a request record like we do for POST
- Instead, capture a simple event indicating the GET request started
- SSE events from the response will be captured using existing `processSSECapture` function
- Consider creating a new capture record type: `"http_request"` for non-JSON-RPC requests

## Problem 2: Missing DELETE /mcp Support

### Issue Description

The MCP HTTP transport specification supports DELETE requests to remove sessions. This is important for:
- Clean session termination
- Resource cleanup on the server side
- Proper session lifecycle management

### Expected Behavior

When a client sends:
```http
DELETE /servers/my-server/mcp HTTP/1.1
Mcp-Session-Id: session-123
MCP-Protocol-Version: 2025-06-18
```

The gateway should:
1. Validate the session header
2. Forward the DELETE request to the target MCP server
3. Return the response to the client (typically 204 No Content)
4. Clean up any local session state (e.g., client info from `capture.ts`)
5. Create a capture record indicating session termination
6. Update server activity metrics
7. Log the deletion to the TUI

### Proposed Implementation

#### Location
Add two new route handlers in `server.ts`:
- `app.delete("/servers/:server/mcp", ...)`
- `app.delete("/s/:server/mcp", ...)`

#### Handler Logic

```typescript
app.delete(
  "/servers/:server/mcp",
  sValidator("param", serverParamSchema),
  sValidator("header", sessionHeaderSchema),
  async (c) => {
    const startTime = Date.now();
    
    // Get validated data
    const { server: serverName } = c.req.valid("param");
    
    // Find server in registry
    const server = getServer(registry, serverName);
    if (!server) {
      return c.notFound();
    }
    
    // Extract session ID from headers
    const validatedHeaders = c.req.valid("header");
    const sessionId = extractSessionId(validatedHeaders);
    
    // Build proxy headers (minimal for DELETE)
    const proxyHeaders: Record<string, string> = {
      "MCP-Protocol-Version":
        c.req.raw.headers.get("MCP-Protocol-Version") || "2025-06-18",
      "Mcp-Session-Id":
        c.req.raw.headers.get("Mcp-Session-Id") ||
        c.req.raw.headers.get("mcp-session-id") ||
        "",
      ...Object.fromEntries(
        Object.entries(server.headers).filter(
          ([key]) => !AUTO_HEADERS.includes(key.toLowerCase()),
        ),
      ),
    };
    
    try {
      // Forward DELETE request to target MCP server
      const targetResponse = await proxy(server.url, {
        method: "DELETE",
        headers: proxyHeaders,
      });
      
      const httpStatus = targetResponse.status;
      const duration = Date.now() - startTime;
      
      // IMPORTANT: Check for 401 early and return as-is
      if (httpStatus === 401) {
        return new Response(targetResponse.body, {
          status: 401,
          headers: targetResponse.headers,
        });
      }
      
      // Clean up local session state
      if (sessionId !== SESSIONLESS_ID) {
        await cleanupSession(sessionId);
      }
      
      // Capture session deletion event
      await captureSessionDeletion(
        storage,
        server.name,
        sessionId,
        httpStatus,
        duration,
      );
      
      // Log deletion
      logSessionDeletion(server, sessionId, httpStatus, duration);
      
      // Update server activity
      await updateServerActivity(storage, registry, server);
      
      // Return response to client
      const responseText = await targetResponse.text();
      const responseHeaders = new Headers(targetResponse.headers);
      for (const header of AUTO_HEADERS) {
        responseHeaders.delete(header);
      }
      
      return new Response(responseText, {
        status: httpStatus,
        headers: responseHeaders,
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log error
      logError(server, sessionId, "DELETE /mcp", 500, duration, error);
      
      // Return error response
      return c.json(
        { error: String(error) },
        500
      );
    }
  }
);
```

#### Helper Functions to Add

```typescript
// Clean up session-related state
async function cleanupSession(sessionId: string): Promise<void> {
  // Remove client info from memory (in capture.ts)
  // Note: This would require exposing a cleanup function in capture.ts
  // For now, this is a placeholder - the session info in memory will be GC'd eventually
  // The capture files persist on disk intentionally
}

// Capture session deletion to JSONL
async function captureSessionDeletion(
  storage: string,
  serverName: string,
  sessionId: string,
  httpStatus: number,
  duration: number,
): Promise<void> {
  const record = {
    type: "session_deleted",
    timestamp: new Date().toISOString(),
    metadata: {
      serverName,
      sessionId,
      httpStatus,
      durationMs: duration,
    },
  };
  
  await appendCapture(storage, {
    ...record,
    serverName,
    sessionId,
  });
}

// Log session deletion
function logSessionDeletion(
  server: McpServer,
  sessionId: string,
  httpStatus: number,
  duration: number,
): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    serverName: server.name,
    sessionId,
    method: "DELETE /mcp",
    httpStatus,
    duration,
    direction: "response",
  };
  
  emitLog(logEntry);
}
```

## Problem 3: Incorrect 401 Response Handling

### Issue Description

Currently, the proxy catches ALL errors (including HTTP 401 responses) and wraps them in JSON-RPC error format. This is problematic because:

1. **401 responses are intentional** - They indicate the server requires authentication
2. **401 responses contain auth info** - Headers like `WWW-Authenticate` tell the client how to authenticate
3. **401 is not a proxy error** - It's a legitimate response that should be forwarded transparently

### Current Problematic Code

In both POST handlers (lines 391-431), errors are caught and wrapped:

```typescript
} catch (error) {
  // ...
  const errorResponse: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: jsonRpcRequest.id ?? null,
    error: {
      code: -32603,
      message: String(error),
    },
  };
  
  return new Response(JSON.stringify(errorResponse), {
    status: httpStatus,
    headers: { "Content-Type": "application/json" },
  });
}
```

The problem is that `httpStatus` might be 401, but we're wrapping it in a JSON-RPC error.

### Expected Behavior

When the target MCP server returns a 401:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="mcp-server"
Content-Type: application/json

{
  "error": "Authentication required",
  "auth_url": "https://auth.example.com/login"
}
```

The gateway should forward this response **exactly as-is** to the client, preserving:
- Status code (401)
- All headers (especially `WWW-Authenticate`)
- Response body (with auth information)

### Proposed Implementation

#### Strategy

Check for 401 status **before** any error handling and return it immediately.

#### Changes to POST Handlers

In both POST route handlers (lines 244-434 and 437-627), add 401 check right after getting `httpStatus`:

```typescript
const targetResponse = await proxy(server.url, {
  method: "POST",
  headers: proxyHeaders,
  body: JSON.stringify(jsonRpcRequest),
});

httpStatus = targetResponse.status;

// CRITICAL: If 401, return response as-is with all auth info
if (httpStatus === 401) {
  const responseText = await targetResponse.text();
  const responseHeaders = new Headers(targetResponse.headers);
  
  // Remove auto-generated headers
  for (const header of AUTO_HEADERS) {
    responseHeaders.delete(header);
  }
  
  // Log the 401 response (for TUI visibility)
  logResponse(
    server,
    sessionId,
    jsonRpcRequest.method,
    401,
    Date.now() - startTime,
  );
  
  // Capture the 401 response
  await captureAuthError(
    storage,
    server.name,
    sessionId,
    jsonRpcRequest,
    responseText,
    401,
  );
  
  return new Response(responseText, {
    status: 401,
    headers: responseHeaders,
  });
}

// Continue with normal SSE/JSON handling...
```

#### Changes to GET Handler

Already included in the GET implementation above (check for 401 early).

#### Changes to DELETE Handler

Already included in the DELETE implementation above (check for 401 early).

#### Helper Function to Add

```typescript
// Capture authentication error with full response
async function captureAuthError(
  storage: string,
  serverName: string,
  sessionId: string,
  request: JsonRpcRequest,
  responseBody: string,
  httpStatus: number,
): Promise<void> {
  const record = {
    type: "auth_error",
    timestamp: new Date().toISOString(),
    request,
    response: {
      status: httpStatus,
      body: responseBody,
    },
    metadata: {
      serverName,
      sessionId,
      method: request.method,
    },
  };
  
  await appendCapture(storage, {
    ...record,
    serverName,
    sessionId,
  });
}
```

### Other HTTP Error Codes to Consider

While fixing 401, consider if other HTTP status codes should also be forwarded transparently:

- **403 Forbidden** - Authorization failed, should be forwarded
- **429 Too Many Requests** - Rate limiting, should include `Retry-After` header
- **503 Service Unavailable** - Server maintenance, should be forwarded

**Recommendation**: Check for any 4xx or 5xx status code and forward transparently, only catching actual network/proxy errors.

#### Enhanced Error Handling

```typescript
const targetResponse = await proxy(server.url, {
  method: "POST",
  headers: proxyHeaders,
  body: JSON.stringify(jsonRpcRequest),
});

httpStatus = targetResponse.status;

// If status indicates an HTTP error (not a successful response), 
// forward it as-is to preserve server's error semantics
if (httpStatus >= 400) {
  const responseText = await targetResponse.text();
  const responseHeaders = new Headers(targetResponse.headers);
  
  for (const header of AUTO_HEADERS) {
    responseHeaders.delete(header);
  }
  
  // Log the error response
  logResponse(
    server,
    sessionId,
    jsonRpcRequest.method,
    httpStatus,
    Date.now() - startTime,
  );
  
  // Capture the error response
  await captureHttpError(
    storage,
    server.name,
    sessionId,
    jsonRpcRequest,
    responseText,
    httpStatus,
  );
  
  return new Response(responseText, {
    status: httpStatus,
    headers: responseHeaders,
  });
}

// Continue with normal SSE/JSON handling for 2xx and 3xx responses...
```

## Implementation Order

### Phase 1: Fix 401 Handling (Highest Priority)
1. Update both POST handlers to check for 401 early
2. Add `captureAuthError` helper function
3. Test with a mock server returning 401
4. Consider expanding to all 4xx/5xx status codes

### Phase 2: Add GET Support
1. Add `buildProxyHeadersForGet` helper
2. Add `logGetRequest` helper
3. Implement GET handler for `/servers/:server/mcp`
4. Implement GET handler for `/s/:server/mcp`
5. Add tests for GET with SSE streams
6. Test 401 handling on GET requests

### Phase 3: Add DELETE Support
1. Add `cleanupSession` helper
2. Add `captureSessionDeletion` helper
3. Add `logSessionDeletion` helper
4. Implement DELETE handler for `/servers/:server/mcp`
5. Implement DELETE handler for `/s/:server/mcp`
6. Add tests for DELETE requests
7. Test 401 handling on DELETE requests

## Testing Strategy

### Unit Tests to Add

1. **GET /mcp tests** (`tests/proxy.test.ts`)
   - GET request returns SSE stream
   - GET request with 401 response
   - GET request with session header
   - GET request captures SSE events

2. **DELETE /mcp tests** (`tests/proxy.test.ts`)
   - DELETE request removes session
   - DELETE request with 401 response
   - DELETE request updates server activity
   - DELETE request creates capture record

3. **401 handling tests** (`tests/proxy.test.ts`)
   - POST with 401 preserves auth headers
   - GET with 401 preserves auth headers
   - DELETE with 401 preserves auth headers
   - 401 response includes original body

### Integration Tests

1. Create test MCP server that:
   - Supports GET requests with SSE
   - Supports DELETE requests
   - Returns 401 with `WWW-Authenticate` header
   - Returns auth info in response body

2. Test scenarios:
   - Full session lifecycle: POST (initialize) → GET (stream) → DELETE (cleanup)
   - Authentication flow: POST → 401 → POST (with auth) → 200
   - Multiple concurrent GET streams
   - DELETE on non-existent session

### Manual Testing

1. Test with real MCP servers (if available)
2. Verify TUI shows GET and DELETE requests
3. Verify capture files include all request types
4. Test with authentication-enabled MCP servers

## Files to Modify

### Primary Changes

1. **`packages/mcp-gateway/src/server.ts`**
   - Add GET route handlers (2 routes)
   - Add DELETE route handlers (2 routes)
   - Update POST route handlers (2 routes) to check for 401 early
   - Add helper functions: `buildProxyHeadersForGet`, `logGetRequest`, `captureSessionDeletion`, `logSessionDeletion`, `captureAuthError`

### Supporting Changes

2. **`packages/mcp-gateway/src/capture.ts`** (optional)
   - Add `cleanupSession` function to remove client info from memory
   - Add `captureHttpError` for general HTTP error capture
   - Update capture record types to include `"http_request"`, `"session_deleted"`, `"auth_error"`

3. **`packages/mcp-gateway/src/schemas.ts`** (optional)
   - Add schemas for GET/DELETE request validation if needed
   - May need to make `jsonRpcRequestSchema` optional for GET/DELETE

### Test Changes

4. **`packages/mcp-gateway/tests/proxy.test.ts`**
   - Add GET request tests
   - Add DELETE request tests
   - Add 401 handling tests for all methods

5. **`test-mcp-server/`** (test server updates)
   - Add GET endpoint that returns SSE
   - Add DELETE endpoint
   - Add 401 authentication responses

## Code Reuse Opportunities

### Extracting Common Logic

Both POST handlers (canonical and short alias) have identical logic. Same will be true for GET and DELETE. Consider:

1. **Extract handler function**:
```typescript
async function handleProxyRequest(
  c: Context,
  method: "GET" | "POST" | "DELETE",
  registry: Registry,
  storage: string,
): Promise<Response> {
  // Common proxy logic
}

app.post("/servers/:server/mcp", validators, (c) => 
  handleProxyRequest(c, "POST", registry, storage)
);
app.post("/s/:server/mcp", validators, (c) => 
  handleProxyRequest(c, "POST", registry, storage)
);
app.get("/servers/:server/mcp", validators, (c) => 
  handleProxyRequest(c, "GET", registry, storage)
);
// etc.
```

2. **Benefits**:
   - Single place to maintain proxy logic
   - Easier to add new HTTP methods
   - Reduced code duplication (currently ~380 lines duplicated)
   - Easier to test

3. **Trade-offs**:
   - More abstraction, potentially harder to follow
   - Need to handle method-specific logic (e.g., POST has JSON body)
   - Could be done as a refactor after adding GET/DELETE

## Backward Compatibility

### Breaking Changes: NONE

All changes are additive:
- Existing POST routes unchanged (just adding 401 check early)
- Adding new GET routes
- Adding new DELETE routes

### Migration Path: NOT NEEDED

Existing clients will continue to work. New features are opt-in.

## Documentation Updates

### Files to Update

1. **`packages/mcp-gateway/README.md`**
   - Document GET endpoint for SSE streams
   - Document DELETE endpoint for session cleanup
   - Document authentication/401 handling
   - Add examples of all three HTTP methods

2. **`packages/mcp-gateway/CHANGELOG.md`**
   - Add entry for new features
   - Note bug fix for 401 handling

3. **`CLAUDE.md`** or **`AGENTS.md`** (if relevant)
   - Update with HTTP method support details

### Example Documentation

```markdown
## HTTP Endpoints

The gateway proxies all MCP HTTP methods to registered servers:

### POST /servers/:server/mcp
Send JSON-RPC requests to the MCP server.

### GET /servers/:server/mcp
Receive Server-Sent Events (SSE) stream from the MCP server.

### DELETE /servers/:server/mcp
Remove a session from the MCP server.

### Authentication

If an MCP server requires authentication, it will return a 401 response:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="mcp-server"

{
  "error": "Authentication required",
  "auth_url": "https://auth.example.com/login"
}
```

The gateway forwards this response transparently to allow clients to handle authentication.
```

## Performance Considerations

### Memory

- GET SSE streams: Two streams created (client + capture), same as current POST SSE handling
- DELETE requests: Minimal memory footprint
- Session cleanup: May reduce memory usage over time

### Disk I/O

- GET requests: Will create capture records for SSE events (same as POST SSE)
- DELETE requests: One additional capture record per session deletion
- 401 responses: One capture record per auth error

### Network

- All methods proxy directly to target server
- No additional buffering beyond current implementation
- SSE streams use tee() for efficient streaming

## Security Considerations

### Authentication Forwarding

- **Critical**: Must preserve ALL auth-related headers from 401 responses
- **Headers to preserve**: `WWW-Authenticate`, `Authorization`, custom auth headers
- **Body to preserve**: May contain auth URLs, error details, refresh tokens

### Session Management

- DELETE should not allow deleting other user's sessions (rely on MCP server's auth)
- Gateway doesn't implement auth itself, just proxies requests
- Session IDs are opaque to the gateway

### Error Information Leakage

- Be careful not to log sensitive auth info in TUI
- Capture files may contain auth info - ensure proper permissions
- Consider redacting sensitive headers in logs (while preserving in proxy)

## Open Questions

1. **Should we add a query parameter for GET requests?**
   - Some MCP servers might need to identify the request type
   - E.g., `GET /mcp?stream=true`

2. **Should session cleanup be automatic?**
   - When a client disconnects, should gateway DELETE automatically?
   - Or rely on client to send DELETE?

3. **Should we support other HTTP methods?**
   - PUT, PATCH for future MCP extensions?
   - OPTIONS for CORS (already handled by Hono)?

4. **Should we expand auto-forwarding beyond 401?**
   - All 4xx errors (403, 429, etc.)?
   - All 5xx errors (503, etc.)?
   - Recommendation: Yes, forward all HTTP errors transparently

## Success Criteria

### Definition of Done

- [ ] GET /servers/:server/mcp returns SSE streams
- [ ] GET /s/:server/mcp returns SSE streams
- [ ] DELETE /servers/:server/mcp removes sessions
- [ ] DELETE /s/:server/mcp removes sessions
- [ ] 401 responses are forwarded transparently with all headers
- [ ] All requests are captured to JSONL files
- [ ] All requests are logged in TUI
- [ ] Server activity metrics are updated
- [ ] Unit tests pass for all methods
- [ ] Integration tests pass with real SSE streams
- [ ] Documentation is updated
- [ ] No breaking changes to existing functionality

### Validation

1. Run existing test suite - all tests pass
2. Run new tests for GET/DELETE - all tests pass
3. Manual test with test-mcp-server for all methods
4. Verify TUI shows all request types
5. Verify capture files contain all request types
6. Test authentication flow with 401 responses

## Conclusion

This plan provides a comprehensive approach to fixing the three identified issues:

1. **GET support** - Enables SSE streaming from proxied servers
2. **DELETE support** - Enables proper session lifecycle management
3. **401 handling** - Preserves authentication information

The implementation is designed to:
- Maintain backward compatibility
- Reuse existing patterns (SSE handling, capture, logging)
- Follow the project's architecture
- Be testable and maintainable

Estimated effort: **2-3 days** for implementation and testing.


# OAuth Implementation Assessment: Gateway vs. Library Responsibilities

## Executive Summary

After reviewing the OAuth implementation in mcp-gateway and comparing it with mcp-lite's built-in OAuth support, it's clear that **we reimplemented significant portions of functionality that already exist in mcp-lite**. This document outlines what should be refactored.

## Current State: What We Implemented in Gateway

### 1. OAuth Discovery (`client-manager.ts`)
```typescript
export async function fetchOAuthDiscovery(serverUrl: string): Promise<OAuthDiscovery | null>
export async function registerOAuthClient(...)
async function fetchOAuthInfo(serverUrl: string)
function extractOAuthInfo(error: unknown)
```

**Status:** ❌ **DUPLICATES LIBRARY FUNCTIONALITY**

mcp-lite already has:
- `discoverOAuthEndpoints(baseUrl)` - RFC 8414 & RFC 8707 compliant discovery
- Follows proper `.well-known/oauth-protected-resource` → authorization server flow
- Validates PKCE S256 support (OAuth 2.1 requirement)

**Issues with our implementation:**
- Only checks `.well-known/oauth-authorization-server` (incomplete)
- Doesn't follow RFC 8707 resource server discovery
- Doesn't check `.well-known/oauth-protected-resource`
- Missing PKCE validation
- Doesn't support multiple authorization servers

### 2. PKCE Generation (`utils/oauth.ts`)
```typescript
function generateRandomString(length: number): string
function generateCodeVerifier(): string
async function generateCodeChallenge(verifier: string): Promise<string>
export async function buildAuthorizationUrl(...)
```

**Status:** ❌ **DUPLICATES LIBRARY FUNCTIONALITY**

mcp-lite's `StandardOAuthProvider` already implements:
- PKCE code verifier generation (32 bytes, base64url)
- Code challenge generation (SHA-256, S256 method)
- State parameter generation (CSRF protection)
- Complete authorization URL construction

**Issues with our implementation:**
- Different random string generation approach (128 chars vs 32 bytes)
- Manual URL construction vs library's proper parameter handling
- Stores state in URL instead of separate persistence
- Missing scope support
- Missing resource parameter (RFC 8707)

### 3. OAuth Callback Handler (`routes/oauth-callback.ts`)
```typescript
export function createOAuthCallbackRoutes(registry, storageDir, options)
```

**Status:** ⚠️ **PARTIAL GATEWAY RESPONSIBILITY**

This is appropriate for the gateway BUT it should be using mcp-lite's client transport OAuth flow, not manual token exchange.

**What should be library:**
- Token exchange logic (params, validation, parsing)
- Token response parsing
- PKCE verification

**What should be gateway:**
- HTTP route handling
- Registry updates
- Persistence to mcp.json
- TUI notifications

### 4. Custom OAuth Headers in Connection (`client-manager.ts:connectServer`)
```typescript
const connection = await connect(server.url, {
  headers: server.headers,
});
```

**Status:** ✅ **CORRECTLY USES LIBRARY FEATURE**

mcp-lite's `StreamableHttpClientTransport` already supports:
- Custom headers in `ConnectOptions`
- Authorization header passthrough
- Header merging with protocol headers

## What Should Be Library vs. Gateway

### ✅ Already in mcp-lite (should use instead of reimplementing)

| Feature | Location in mcp-lite | Current Gateway Implementation |
|---------|---------------------|-------------------------------|
| OAuth Discovery | `client/oauth-discovery.ts` | `client-manager.ts:fetchOAuthDiscovery()` ❌ |
| PKCE Generation | `client/oauth-provider.ts:StandardOAuthProvider` | `utils/oauth.ts:generateCodeVerifier()` ❌ |
| Code Challenge | `client/oauth-provider.ts:generateCodeChallenge()` | `utils/oauth.ts:generateCodeChallenge()` ❌ |
| State Generation | `client/oauth-provider.ts:generateState()` | Embedded in `buildAuthorizationUrl()` ❌ |
| Authorization URL | `client/oauth-provider.ts:startAuthorizationFlow()` | `utils/oauth.ts:buildAuthorizationUrl()` ❌ |
| Token Exchange | `client/oauth-provider.ts:exchangeCodeForTokens()` | `routes/oauth-callback.ts` (manual fetch) ❌ |
| Token Refresh | `client/oauth-provider.ts:refreshAccessToken()` | NOT IMPLEMENTED ❌ |
| Token Storage Interface | `client/oauth-adapter.ts:OAuthAdapter` | Manual server.headers modification ❌ |
| Token Expiry Check | `client/oauth-adapter.ts:hasValidToken()` | NOT IMPLEMENTED ❌ |
| Automatic Token Refresh | `client/transport-http.ts:ensureValidToken()` | NOT IMPLEMENTED ❌ |
| 401 Detection & Flow | `client/transport-http.ts:handleAuthenticationRequired()` | Manual error parsing ❌ |
| Custom Headers | `client/transport-http.ts:ConnectOptions` | ✅ USING CORRECTLY |

### 🔄 Should Be Gateway (application-specific)

| Feature | Why Gateway Responsibility | Current Status |
|---------|---------------------------|----------------|
| OAuth Callback Route | HTTP server endpoint | ✅ Implemented |
| Browser Opening | CLI/TUI integration | ✅ Implemented (`openBrowser()`) |
| Token Persistence | mcp.json format | ✅ Implemented (but manual) |
| Registry Updates | Gateway-specific | ✅ Implemented |
| TUI Notifications | User interface | ✅ Implemented |
| Dynamic Client Registration (DCR) | Optional gateway feature | ⚠️ Implemented but unused |

## Recommended Refactoring

### Phase 1: Adopt mcp-lite OAuth Interfaces

```typescript
import {
  StreamableHttpClientTransport,
  StandardOAuthProvider,
  InMemoryOAuthAdapter,
  type OAuthConfig
} from 'mcp-lite';

class GatewayOAuthAdapter implements OAuthAdapter {
  constructor(private registry: Registry, private storageDir: string) {}

  async storeTokens(resource: string, tokens: OAuthTokens): Promise<void> {
    // Find server by URL
    const server = this.registry.servers.find(s => s.url === resource);
    if (server) {
      server.headers = {
        ...server.headers,
        Authorization: `Bearer ${tokens.accessToken}`
      };
      // Also store refresh token, expiry for proper token management
      server.oauthToken = tokens.accessToken;
      server.oauthTokenExpiresAt = tokens.expiresAt;
      server.oauthRefreshToken = tokens.refreshToken;

      await saveRegistry(this.storageDir, this.registry);
    }
  }

  async getTokens(resource: string): Promise<OAuthTokens | undefined> {
    const server = this.registry.servers.find(s => s.url === resource);
    if (!server?.oauthToken) return undefined;

    return {
      accessToken: server.oauthToken,
      refreshToken: server.oauthRefreshToken,
      expiresAt: server.oauthTokenExpiresAt || 0,
      scopes: [], // Could store in registry
      tokenType: 'Bearer'
    };
  }

  async hasValidToken(resource: string): Promise<boolean> {
    const tokens = await this.getTokens(resource);
    if (!tokens) return false;

    const now = Math.floor(Date.now() / 1000);
    const BUFFER = 5 * 60; // 5 minute buffer
    return tokens.expiresAt > now + BUFFER;
  }

  async deleteTokens(resource: string): Promise<void> {
    const server = this.registry.servers.find(s => s.url === resource);
    if (server) {
      delete server.headers.Authorization;
      delete server.oauthToken;
      delete server.oauthTokenExpiresAt;
      delete server.oauthRefreshToken;
      await saveRegistry(this.storageDir, this.registry);
    }
  }
}
```

### Phase 2: Use Library's OAuth Flow

```typescript
class ClientManager {
  private oauthAdapter: GatewayOAuthAdapter;
  private oauthProvider: StandardOAuthProvider;

  constructor(registry: Registry, storageDir: string, gatewayPort: number) {
    this.oauthAdapter = new GatewayOAuthAdapter(registry, storageDir);
    this.oauthProvider = new StandardOAuthProvider();
  }

  async connectServer(server: McpServer): Promise<Connection> {
    const client = new McpClient({ name: 'mcp-gateway', version: '1.0.0' });

    const transport = new StreamableHttpClientTransport({
      oauthAdapter: this.oauthAdapter,
      oauthProvider: this.oauthProvider,
      oauthConfig: {
        clientId: server.oauthClientId || 'mcp-gateway',
        redirectUri: `http://localhost:${this.gatewayPort}/oauth/callback`,
        onAuthorizationRequired: (authUrl) => {
          // Store auth URL in registry for TUI to display
          server.authUrl = authUrl;
          saveRegistry(this.storageDir, this.registry);

          // Emit event to TUI
          this.onRegistryUpdate?.();
        }
      }
    });

    const connect = transport.bind(client);

    try {
      // Library handles OAuth automatically!
      const connection = await connect(server.url, {
        headers: server.headers // Other auth headers (API keys, etc)
      });

      return connection;
    } catch (error) {
      // Library throws specific error when auth is required
      // It also already called onAuthorizationRequired callback
      throw error;
    }
  }
}
```

### Phase 3: Simplify OAuth Callback

```typescript
export function createOAuthCallbackRoutes(
  registry: Registry,
  storageDir: string,
  clientManager: ClientManager,
  options?: { onRegistryUpdate?: () => void }
): Hono {
  const app = new Hono();

  app.get('/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      return c.html(`<h1>Authorization Failed</h1><p>${error}</p>`);
    }

    if (!code || !state) {
      return c.html(`<h1>Invalid OAuth Callback</h1>`, 400);
    }

    try {
      // Parse state to get server info
      // (Could be improved - library should provide state parsing)
      const stateData = JSON.parse(decodeURIComponent(state));
      const serverName = stateData.serverName;

      const server = getServer(registry, serverName);
      if (!server) {
        throw new Error(`Server ${serverName} not found`);
      }

      // Let the library handle token exchange!
      const transport = clientManager.getTransport(serverName);
      await transport.completeAuthorizationFlow(server.url, code, state);

      // Tokens are now stored via OAuthAdapter
      // Registry is already updated by GatewayOAuthAdapter.storeTokens()

      // Clear auth fields
      delete server.authUrl;
      delete server.authError;
      await saveRegistry(storageDir, registry);

      if (options?.onRegistryUpdate) {
        options.onRegistryUpdate();
      }

      return c.html(`<h1>✅ Authorization Successful!</h1>`);
    } catch (error) {
      return c.html(`<h1>Authorization Failed</h1><p>${error.message}</p>`, 500);
    }
  });

  return app;
}
```

## Benefits of Using Library OAuth

### 1. **RFC Compliance**
- ✅ RFC 8414 (Authorization Server Metadata)
- ✅ RFC 8707 (Resource Indicators)
- ✅ RFC 7636 (PKCE)
- ✅ OAuth 2.1 requirements

### 2. **Automatic Token Management**
- ✅ Automatic token refresh before expiry
- ✅ Token expiry checking with buffer
- ✅ Refresh token handling
- ✅ No manual Bearer header management

### 3. **Security**
- ✅ Proper PKCE implementation
- ✅ State validation (CSRF protection)
- ✅ Code verifier security
- ✅ Token storage abstraction

### 4. **Less Code**
- ❌ Remove ~200 lines from client-manager.ts
- ❌ Remove ~90 lines from utils/oauth.ts
- ❌ Simplify ~150 lines in oauth-callback.ts
- ✅ Add ~80 lines for GatewayOAuthAdapter
- **Net: ~360 lines removed, better functionality**

### 5. **Correctness**
- ✅ Library is tested against MCP spec
- ✅ Handles edge cases we missed
- ✅ Proper error messages
- ✅ Standard interfaces

## What We Should Keep

### 1. Browser Opening (`utils/oauth.ts:openBrowser`)
**Why:** Platform-specific CLI functionality
```typescript
export async function openBrowser(url: string): Promise<void>
```

### 2. OAuth Callback Route Structure
**Why:** Gateway-specific HTTP endpoint
- Keep route handler
- Simplify using library's `completeAuthorizationFlow()`

### 3. Registry OAuth State
**Why:** Gateway needs to show auth status in TUI
```typescript
interface McpServer {
  authUrl?: string;      // Keep - for TUI display
  authError?: string;    // Keep - for error display
  // Add proper token storage:
  oauthToken?: string;
  oauthTokenExpiresAt?: number;
  oauthRefreshToken?: string;
}
```

## Migration Path

### Step 1: Add Token Fields to Registry Types
```typescript
// packages/types/src/registry.ts
export interface McpServer {
  // ... existing fields
  oauthToken?: string;
  oauthTokenExpiresAt?: number;
  oauthRefreshToken?: string;
}
```

### Step 2: Implement GatewayOAuthAdapter
Create `packages/core/src/mcp/oauth-adapter.ts` implementing `OAuthAdapter` interface

### Step 3: Replace connectServer Logic
Update `client-manager.ts` to use `StreamableHttpClientTransport` with OAuth config

### Step 4: Simplify OAuth Callback
Update `oauth-callback.ts` to use `transport.completeAuthorizationFlow()`

### Step 5: Remove Duplicate Code
Delete:
- `client-manager.ts:fetchOAuthDiscovery()`
- `client-manager.ts:registerOAuthClient()`
- `client-manager.ts:fetchOAuthInfo()`
- `client-manager.ts:extractOAuthInfo()`
- `utils/oauth.ts:generateRandomString()`
- `utils/oauth.ts:generateCodeVerifier()`
- `utils/oauth.ts:generateCodeChallenge()`
- `utils/oauth.ts:buildAuthorizationUrl()`
- Most of `oauth-callback.ts` token exchange logic

### Step 6: Add Token Refresh Support
Once using library, token refresh happens automatically via `ensureValidToken()`

## Conclusion

**We reimplemented ~70% of OAuth functionality that already exists in mcp-lite.**

The library provides:
- ✅ Better OAuth 2.1 compliance
- ✅ Automatic token refresh
- ✅ Proper RFC-compliant discovery
- ✅ Security best practices
- ✅ Tested implementation
- ✅ Less code to maintain

We should migrate to use mcp-lite's OAuth infrastructure and only implement gateway-specific pieces:
- OAuth adapter for registry persistence
- HTTP callback endpoint
- Browser opening
- TUI integration

This will result in:
- 🎯 Less code (~360 lines removed)
- 🎯 Better functionality (token refresh, proper discovery)
- 🎯 Fewer bugs (library is tested)
- 🎯 Easier maintenance
- 🎯 RFC-compliant implementation

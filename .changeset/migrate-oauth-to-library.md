---
"@fiberplane/mcp-gateway-core": minor
"@fiberplane/mcp-gateway-server": minor
"@fiberplane/mcp-gateway-cli": patch
"@fiberplane/mcp-gateway-types": minor
---

Migrate OAuth implementation to use mcp-lite's built-in infrastructure

Replaced custom OAuth implementation with mcp-lite's battle-tested OAuth infrastructure. This migration provides better RFC compliance, automatic token refresh, and significantly reduces code maintenance burden.

**Key Changes:**

- Created `GatewayOAuthAdapter` implementing mcp-lite's `OAuthAdapter` interface for registry-based token storage
- Updated `ClientManager` to use mcp-lite's `StandardOAuthProvider` and `StreamableHttpClientTransport` with OAuth config
- Simplified OAuth callback route to use library's `completeAuthorizationFlow()` instead of manual token exchange
- Added token persistence fields to `McpServer` type: `oauthToken`, `oauthTokenExpiresAt`, `oauthRefreshToken`
- Removed manual OAuth implementation (~200 lines): discovery, PKCE generation, authorization URL building, token exchange

**Benefits:**

- RFC 6749 and RFC 7636 (PKCE) compliant OAuth 2.1 implementation
- Automatic token refresh before expiry (5-minute buffer)
- Proper OAuth discovery via `.well-known/oauth-authorization-server`
- Reduced code maintenance (~200 lines removed)
- Better error handling and security

**Breaking Changes:**

None - the migration is backward compatible. Existing OAuth flows continue to work, now backed by library implementation.

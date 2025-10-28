import type { OAuthAdapter, OAuthTokens } from "mcp-lite";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import { saveRegistry } from "../registry/storage.js";

/**
 * OAuth adapter that stores tokens in the MCP Gateway registry.
 * Implements mcp-lite's OAuthAdapter interface to integrate with the library's OAuth flow.
 */
export class GatewayOAuthAdapter implements OAuthAdapter {
  constructor(
    private registry: Registry,
    private storageDir: string,
  ) {}

  async storeTokens(resource: string, tokens: OAuthTokens): Promise<void> {
    const server = this.registry.servers.find((s) => s.url === resource);
    if (server) {
      server.headers = {
        ...server.headers,
        Authorization: `Bearer ${tokens.accessToken}`,
      };
      server.oauthToken = tokens.accessToken;
      server.oauthTokenExpiresAt = tokens.expiresAt;
      server.oauthRefreshToken = tokens.refreshToken;

      await saveRegistry(this.storageDir, this.registry);
    }
  }

  async getTokens(resource: string): Promise<OAuthTokens | undefined> {
    const server = this.registry.servers.find((s) => s.url === resource);
    if (!server?.oauthToken) return undefined;

    return {
      accessToken: server.oauthToken,
      refreshToken: server.oauthRefreshToken,
      expiresAt: server.oauthTokenExpiresAt || 0,
      scopes: [],
      tokenType: "Bearer",
    };
  }

  async hasValidToken(resource: string): Promise<boolean> {
    const tokens = await this.getTokens(resource);
    if (!tokens) return false;

    const now = Math.floor(Date.now() / 1000);
    const BUFFER = 5 * 60; // 5 minutes buffer
    return tokens.expiresAt > now + BUFFER;
  }

  async deleteTokens(resource: string): Promise<void> {
    const server = this.registry.servers.find((s) => s.url === resource);
    if (server) {
      delete server.headers.Authorization;
      delete server.oauthToken;
      delete server.oauthTokenExpiresAt;
      delete server.oauthRefreshToken;
      await saveRegistry(this.storageDir, this.registry);
    }
  }
}

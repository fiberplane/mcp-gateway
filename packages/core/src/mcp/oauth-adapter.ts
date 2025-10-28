import type {
	OAuthAdapter,
	OAuthTokens,
	StoredClientCredentials,
} from "mcp-lite";
import type { Registry } from "@fiberplane/mcp-gateway-types";
import { saveRegistry } from "../registry/storage.js";
import { logger } from "../logger.js";

/**
 * OAuth adapter that stores tokens in the MCP Gateway registry.
 * Implements mcp-lite's OAuthAdapter interface to integrate with the library's OAuth flow.
 *
 * Client credentials from Dynamic Client Registration are stored in-memory only,
 * as they can be re-registered dynamically if needed.
 */
export class GatewayOAuthAdapter implements OAuthAdapter {
	private clientCredentials = new Map<string, StoredClientCredentials>();

	constructor(
		private registry: Registry,
		private storageDir: string,
	) {
		logger.debug("GatewayOAuthAdapter initialized", {
			serverCount: registry.servers.length,
		});
	}

  async storeTokens(resource: string, tokens: OAuthTokens): Promise<void> {
    logger.info("OAuth: Storing tokens for resource", {
      resource,
      hasRefreshToken: !!tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      expiresIn: tokens.expiresAt - Math.floor(Date.now() / 1000),
      scopes: tokens.scopes,
    });

    const server = this.registry.servers.find((s) => s.url === resource);
    if (!server) {
      logger.error("OAuth: Server not found for resource", {
        resource,
        availableServers: this.registry.servers.map((s) => s.url),
      });
      return;
    }

    logger.debug("OAuth: Found server, updating tokens", {
      serverName: server.name,
      resource,
    });

    server.headers = {
      ...server.headers,
      Authorization: `Bearer ${tokens.accessToken}`,
    };
    server.oauthToken = tokens.accessToken;
    server.oauthTokenExpiresAt = tokens.expiresAt;
    server.oauthRefreshToken = tokens.refreshToken;

    await saveRegistry(this.storageDir, this.registry);

    logger.info("OAuth: Tokens stored successfully", {
      serverName: server.name,
      resource,
    });
  }

  async getTokens(resource: string): Promise<OAuthTokens | undefined> {
    logger.debug("OAuth: Getting tokens for resource", { resource });

    const server = this.registry.servers.find((s) => s.url === resource);
    if (!server?.oauthToken) {
      logger.debug("OAuth: No tokens found", {
        resource,
        serverFound: !!server,
        hasToken: !!server?.oauthToken,
      });
      return undefined;
    }

    logger.debug("OAuth: Retrieved tokens", {
      resource,
      serverName: server.name,
      hasRefreshToken: !!server.oauthRefreshToken,
      expiresAt: server.oauthTokenExpiresAt,
    });

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
    if (!tokens) {
      logger.debug("OAuth: No valid token - tokens not found", { resource });
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const BUFFER = 5 * 60; // 5 minutes buffer
    const isValid = tokens.expiresAt > now + BUFFER;

    logger.debug("OAuth: Token validity check", {
      resource,
      isValid,
      expiresAt: tokens.expiresAt,
      now,
      buffer: BUFFER,
      expiresIn: tokens.expiresAt - now,
    });

    return isValid;
  }

	async deleteTokens(resource: string): Promise<void> {
		logger.info("OAuth: Deleting tokens for resource", { resource });

		const server = this.registry.servers.find((s) => s.url === resource);
		if (!server) {
			logger.warn("OAuth: Server not found for deletion", { resource });
			return;
		}

		delete server.headers.Authorization;
		delete server.oauthToken;
		delete server.oauthTokenExpiresAt;
		delete server.oauthRefreshToken;
		await saveRegistry(this.storageDir, this.registry);

		logger.info("OAuth: Tokens deleted successfully", {
			serverName: server.name,
			resource,
		});
	}

	async storeClientCredentials(
		authorizationServer: string,
		credentials: StoredClientCredentials,
	): Promise<void> {
		logger.info("OAuth: Storing client credentials for authorization server", {
			authorizationServer,
			clientId: credentials.clientId,
			hasClientSecret: !!credentials.clientSecret,
			hasRegistrationAccessToken: !!credentials.registrationAccessToken,
		});

		this.clientCredentials.set(authorizationServer, credentials);

		logger.debug("OAuth: Client credentials stored successfully", {
			authorizationServer,
			clientId: credentials.clientId,
		});
	}

	async getClientCredentials(
		authorizationServer: string,
	): Promise<StoredClientCredentials | undefined> {
		logger.debug("OAuth: Getting client credentials for authorization server", {
			authorizationServer,
		});

		const credentials = this.clientCredentials.get(authorizationServer);

		if (credentials) {
			logger.debug("OAuth: Retrieved client credentials", {
				authorizationServer,
				clientId: credentials.clientId,
			});
		} else {
			logger.debug("OAuth: No client credentials found", {
				authorizationServer,
			});
		}

		return credentials;
	}

	async deleteClientCredentials(authorizationServer: string): Promise<void> {
		logger.info("OAuth: Deleting client credentials for authorization server", {
			authorizationServer,
		});

		this.clientCredentials.delete(authorizationServer);

		logger.debug("OAuth: Client credentials deleted successfully", {
			authorizationServer,
		});
	}
}

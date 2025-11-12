import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

const BEARER_PREFIX = "Bearer ";
const MAX_TOKEN_LENGTH = 256; // Reasonable max to prevent DoS

/**
 * Create authentication middleware that validates Bearer tokens
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param expectedToken - The valid authentication token
 * @returns Hono middleware handler
 */
export function createAuthMiddleware(expectedToken: string): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    // Check for Authorization header presence and Bearer scheme
    if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }

    // Extract token (everything after "Bearer ") and trim whitespace
    const token = authHeader.slice(BEARER_PREFIX.length).trim();

    // Validate token length to prevent empty tokens and DoS attacks
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      return c.json({ error: "Invalid token" }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }

    // Use constant-time comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token, "utf8");
    const expectedBuffer = Buffer.from(expectedToken, "utf8");

    // Length check (required for timingSafeEqual)
    if (tokenBuffer.length !== expectedBuffer.length) {
      return c.json({ error: "Invalid token" }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }

    // Constant-time comparison
    if (!timingSafeEqual(tokenBuffer, expectedBuffer)) {
      return c.json({ error: "Invalid token" }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }

    await next();
  };
}

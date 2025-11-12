import type { MiddlewareHandler } from "hono";

/**
 * Create authentication middleware that validates Bearer tokens
 *
 * @param expectedToken - The valid authentication token
 * @returns Hono middleware handler
 */
export function createAuthMiddleware(expectedToken: string): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (token !== expectedToken) {
      return c.json({ error: "Invalid token" }, 401);
    }

    await next();
  };
}

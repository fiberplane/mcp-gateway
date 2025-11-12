import { randomBytes } from "node:crypto";

/**
 * Generate a cryptographically secure random token
 *
 * @returns Base64url-encoded token (URL-safe, 43 characters)
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Load token from environment variable or generate a new one
 *
 * Priority:
 * 1. MCP_GATEWAY_TOKEN environment variable
 * 2. Auto-generated secure token
 *
 * @returns Authentication token
 */
export function loadOrGenerateToken(): string {
  const envToken = process.env.MCP_GATEWAY_TOKEN;

  if (envToken) {
    return envToken;
  }

  return generateToken();
}

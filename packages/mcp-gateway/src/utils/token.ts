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
 * 1. MCP_GATEWAY_TOKEN environment variable (if non-empty)
 * 2. Auto-generated secure token
 *
 * @returns Authentication token
 */
export function loadOrGenerateToken(): string {
  const envToken = process.env.MCP_GATEWAY_TOKEN?.trim();

  if (envToken && envToken.length > 0) {
    // Warn if custom token looks weak
    if (envToken.length < 32) {
      // biome-ignore lint/suspicious/noConsole: User-facing security warning
      console.warn(
        "⚠️  MCP_GATEWAY_TOKEN is shorter than recommended (32+ characters)",
      );
      // biome-ignore lint/suspicious/noConsole: User-facing security warning
      console.warn("   For better security, use: openssl rand -base64 32");
    }
    return envToken;
  }

  return generateToken();
}

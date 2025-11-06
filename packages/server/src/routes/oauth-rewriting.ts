/**
 * OAuth URL rewriting utilities for proxying OAuth discovery metadata
 *
 * Provides minimal URL rewriting for OAuth protected resource metadata
 * to satisfy MCP Inspector validation while keeping OAuth flows direct.
 */

/**
 * Get gateway base URL from request context
 * Derives protocol from request URL, with optional config override
 */
export function getGatewayBaseUrl(
  requestUrl: string,
  requestHost: string | null | undefined,
  configUrl?: string,
): string {
  if (configUrl) {
    return configUrl;
  }

  // Derive protocol from request URL
  let protocol = "http"; // Default to HTTP for safety
  try {
    const url = new URL(requestUrl);
    protocol = url.protocol.replace(":", "");
  } catch {
    // If URL parsing fails, fallback to HTTP
  }

  // Use Host header (works for localhost and tunnels)
  const host = requestHost || "localhost:3333";

  return `${protocol}://${host}`;
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 8707)
 */
export interface ProtectedResourceMetadata {
  resource: string;
  resource_name?: string;
  resource_documentation?: string;
  authorization_servers?: string[];
  bearer_methods_supported?: string[];
  [key: string]: unknown;
}

/**
 * Rewrite only the resource field in protected resource metadata
 * Leaves all other fields (authorization_servers, etc.) unchanged
 *
 * @param metadata - Original protected resource metadata from upstream
 * @param serverName - Server name in gateway config (e.g., "notion")
 * @param gatewayBase - Gateway base URL (e.g., "http://localhost:3333")
 * @param pathPrefix - URL path prefix ("servers" or "s")
 * @returns Metadata with rewritten resource field
 */
export function rewriteProtectedResourceMetadata(
  metadata: ProtectedResourceMetadata,
  serverName: string,
  gatewayBase: string,
  pathPrefix: string = "s",
): ProtectedResourceMetadata {
  return {
    ...metadata,
    resource: `${gatewayBase}/${pathPrefix}/${serverName}/mcp`,
  };
}

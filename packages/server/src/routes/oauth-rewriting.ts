/**
 * OAuth URL rewriting utilities for proxying OAuth discovery metadata
 *
 * Provides minimal URL rewriting for OAuth protected resource metadata
 * to satisfy MCP Inspector validation while keeping OAuth flows direct.
 */

/**
 * Get gateway base URL from request context
 * Uses Host header by default, with optional config override
 */
export function getGatewayBaseUrl(
  requestHost: string | null | undefined,
  configUrl?: string,
): string {
  if (configUrl) {
    return configUrl;
  }

  // Use Host header (works for localhost and tunnels)
  const host = requestHost || "localhost:3333";

  // For localhost, always use http (OAuth clients often run on http://localhost)
  // For other hosts, assume https (production deployments)
  const protocol = host.includes("localhost") ? "http" : "https";

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

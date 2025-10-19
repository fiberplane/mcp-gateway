/**
 * Gateway URL utilities
 * Provides helpers to generate gateway URLs dynamically based on port
 */

/**
 * Get the base URL for the gateway server
 */
export function getGatewayBaseUrl(port: number): string {
  return `http://localhost:${port}`;
}

/**
 * Get the MCP endpoint URL for a specific server
 */
export function getServerMcpUrl(port: number, serverName: string): string {
  const encodedName = encodeURIComponent(serverName);
  return `${getGatewayBaseUrl(port)}/servers/${encodedName}/mcp`;
}

/**
 * Get the gateway's own introspection MCP endpoint URL
 */
export function getGatewayMcpUrl(port: number): string {
  return `${getGatewayBaseUrl(port)}/gateway/mcp`;
}

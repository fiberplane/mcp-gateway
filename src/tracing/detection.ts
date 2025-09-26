export function quickMCPCheck(request: Request): boolean {
  // Fast checks only (1-2ms total)
  const contentType = request.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return false;
  }

  const url = new URL(request.url);
  if (!isMCPEndpointPattern(url.pathname)) {
    return false;
  }

  // Check for MCP headers
  const mcpHeaders =
    request.headers.get("X-MCP-Session-Id") ||
    request.headers.get("MCP-Protocol-Version");
  if (mcpHeaders) {
    return true;
  }

  // For POST requests to suspected MCP endpoints, capture body
  return request.method === "POST";
}

function isMCPEndpointPattern(pathname: string): boolean {
  return pathname.includes("/mcp") || pathname.includes("/api/mcp");
}

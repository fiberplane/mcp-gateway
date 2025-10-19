import type { UIServer } from "../../store";

export type Server = UIServer;

/**
 * Get human-readable status text from health status
 */
export function getStatusText(health?: string): string {
  switch (health) {
    case "up":
      return "✓ up";
    case "down":
      return "✗ down";
    default:
      return "? unknown";
  }
}

/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 */
export function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "—";
  }
}

/**
 * Generate MCP configuration JSON for Claude Desktop
 */
export function generateMcpConfig(server: Server, port: number): string {
  const encodedName = encodeURIComponent(server.name);
  const gatewayUrl = `http://localhost:${port}/servers/${encodedName}/mcp`;

  return JSON.stringify(
    {
      mcpServers: {
        [server.name]: {
          transport: "sse",
          url: gatewayUrl,
        },
      },
    },
    null,
    2,
  );
}

/**
 * Get gateway URL for a server
 */
export function getGatewayUrl(serverName: string, port: number): string {
  const encodedName = encodeURIComponent(serverName);
  return `http://localhost:${port}/servers/${encodedName}/mcp`;
}

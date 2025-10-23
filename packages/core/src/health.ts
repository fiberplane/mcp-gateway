import type { HealthStatus } from "@fiberplane/mcp-gateway-types";

export async function checkServerHealth(url: string): Promise<HealthStatus> {
  try {
    // Try OPTIONS first (lightweight), fallback to HEAD
    const response = await fetch(url, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    // 2xx, 3xx, 4xx all mean server is responding
    // Only 5xx or network errors mean "down"
    if (response.status < 500) {
      return "up";
    }

    return "down";
  } catch (_error) {
    // Network errors, timeouts, DNS failures = down
    return "down";
  }
}

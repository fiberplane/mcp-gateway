import type { Registry, ServerHealth } from "@fiberplane/mcp-gateway-types";

export async function checkServerHealth(url: string): Promise<ServerHealth> {
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

export async function startHealthChecks(
  registry: Registry,
  intervalMs_ms: number = 30000,
  onHealthUpdate?: (
    updates: Array<{
      name: string;
      health: ServerHealth;
      lastHealthCheck: string;
    }>,
  ) => void,
): Promise<() => void> {
  const checkAll = async () => {
    const updates = await Promise.all(
      registry.servers.map(async (server) => {
        const health = await checkServerHealth(server.url);
        const lastHealthCheck = new Date().toISOString();

        // Update the registry object for non-TUI usage
        server.health = health;
        server.lastHealthCheck = lastHealthCheck;

        return {
          name: server.name,
          health,
          lastHealthCheck,
        };
      }),
    );

    // Call custom update handler if provided (for TUI)
    if (onHealthUpdate) {
      onHealthUpdate(updates);
    }
  };

  // Initial check (await to ensure it completes before returning)
  await checkAll();

  // Periodic checks
  const timer = setInterval(checkAll, intervalMs_ms);

  // Return cleanup function
  return () => clearInterval(timer);
}

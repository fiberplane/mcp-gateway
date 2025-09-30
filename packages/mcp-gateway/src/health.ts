import type { Registry, ServerHealth } from "./registry.js";
import { emitRegistryUpdate } from "./tui/events.js";

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
): Promise<() => void> {
  const checkAll = async () => {
    const checks = registry.servers.map(async (server) => {
      server.health = await checkServerHealth(server.url);
      server.lastHealthCheck = new Date().toISOString();
    });

    await Promise.all(checks);
    emitRegistryUpdate();
  };

  // Initial check (await to ensure it completes before returning)
  await checkAll();

  // Periodic checks
  const timer = setInterval(checkAll, intervalMs_ms);

  // Return cleanup function
  return () => clearInterval(timer);
}

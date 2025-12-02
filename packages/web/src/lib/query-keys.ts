import type { QueryClient } from "@tanstack/react-query";

/**
 * Centralized query keys for React Query
 *
 * Prevents typos and provides type safety for query invalidation
 */
export const queryKeys = {
  servers: ["servers"] as const,
  serverConfigs: ["server-configs"] as const,
  logs: ["logs"] as const,
  sessions: ["sessions"] as const,
  clients: ["clients"] as const,
} as const;

/**
 * Invalidate all server-related queries
 *
 * Commonly used after server mutations (add, delete, restart)
 */
export function invalidateServerQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.serverConfigs }),
    queryClient.invalidateQueries({ queryKey: queryKeys.servers }),
  ]);
}

/**
 * Invalidate all queries after clearing sessions
 */
export function invalidateAllQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.logs }),
    queryClient.invalidateQueries({ queryKey: queryKeys.servers }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.clients }),
  ]);
}

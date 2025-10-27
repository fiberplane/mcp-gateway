/**
 * TanStack Query hooks for fetching available filter values
 *
 * These hooks provide data for the cascading filter menus, allowing users
 * to select from actual values present in the logs rather than typing manually.
 *
 * All hooks use a 5-second refetch interval to keep data fresh as new logs arrive.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Fetch available methods with log counts
 *
 * Used in the Method filter submenu to show which methods are in the logs.
 *
 * @param serverName - Optional server filter
 * @returns Query result with methods array
 *
 * @example
 * const { data, isLoading } = useAvailableMethods();
 * data?.methods // [{ method: "tools/call", logCount: 42 }, ...]
 */
export function useAvailableMethods(serverName?: string) {
  return useQuery({
    queryKey: ["methods", serverName],
    queryFn: async () => await api.getMethods(serverName),
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 4000, // Consider data stale after 4 seconds
  });
}

/**
 * Fetch available clients with log counts
 *
 * Used in the Client filter submenu to show which clients are in the logs.
 *
 * @returns Query result with clients array
 *
 * @example
 * const { data, isLoading } = useAvailableClients();
 * data?.clients // [{ clientName: "claude-code", clientVersion: "1.0.0", ... }, ...]
 */
export function useAvailableClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => await api.getClients(),
    refetchInterval: 5000,
    staleTime: 4000,
  });
}

/**
 * Fetch available sessions with log counts
 *
 * Used in the Session filter submenu to show which sessions are in the logs.
 *
 * @param serverName - Optional server filter
 * @returns Query result with sessions array
 *
 * @example
 * const { data, isLoading } = useAvailableSessions("my-server");
 * data?.sessions // [{ sessionId: "abc123", serverName: "...", ... }, ...]
 */
export function useAvailableSessions(serverName?: string) {
  return useQuery({
    queryKey: ["sessions", serverName],
    queryFn: async () => await api.getSessions(serverName),
    refetchInterval: 5000,
    staleTime: 4000,
  });
}

/**
 * Fetch available servers with log counts
 *
 * Used in the Server filter submenu to show which servers are in the logs.
 *
 * @returns Query result with servers array
 *
 * @example
 * const { data, isLoading } = useAvailableServers();
 * data?.servers // [{ name: "my-server", logCount: 100, ... }, ...]
 */
export function useAvailableServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => await api.getServers(),
    refetchInterval: 5000,
    staleTime: 4000,
  });
}

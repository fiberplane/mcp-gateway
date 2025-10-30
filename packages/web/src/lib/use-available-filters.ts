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

interface UseAvailableMethodsOptions {
  /** Optional server filter to scope the results */
  serverName?: string;
  /** Whether to fetch data (defaults to true) */
  enabled?: boolean;
}

/**
 * Fetch available methods
 *
 * Used in the Method filter submenu to show which methods are in the logs.
 *
 * @param options - Query options
 * @returns Query result with methods array
 *
 * @example
 * const { data, isLoading } = useAvailableMethods({ enabled: open });
 * data?.methods // [{ method: "tools/call" }, ...]
 */
export function useAvailableMethods(options: UseAvailableMethodsOptions = {}) {
  const { serverName, enabled = true } = options;
  return useQuery({
    queryKey: ["methods", serverName],
    queryFn: async () => await api.getMethods(serverName),
    refetchInterval: enabled ? 5000 : false, // Only refresh when enabled
    staleTime: 4000, // Consider data stale after 4 seconds
    enabled, // Control whether query runs
  });
}

interface UseAvailableClientsOptions {
  /** Whether to fetch data (defaults to true) */
  enabled?: boolean;
}

/**
 * Fetch available clients
 *
 * Used in the Client filter submenu to show which clients are in the logs.
 *
 * @param options - Query options
 * @returns Query result with clients array
 *
 * @example
 * const { data, isLoading } = useAvailableClients({ enabled: open });
 * data?.clients // [{ clientName: "claude-code", clientVersion: "1.0.0" }, ...]
 */
export function useAvailableClients(options: UseAvailableClientsOptions = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => await api.getClients(),
    refetchInterval: enabled ? 5000 : false, // Only refresh when enabled
    staleTime: 4000,
    enabled, // Control whether query runs
  });
}

interface UseAvailableSessionsOptions {
  /** Optional server filter to scope the results */
  serverName?: string;
  /** Whether to fetch data (defaults to true) */
  enabled?: boolean;
}

/**
 * Fetch available sessions
 *
 * Used in the Session filter submenu to show which sessions are in the logs.
 *
 * @param options - Query options
 * @returns Query result with sessions array
 *
 * @example
 * const { data, isLoading } = useAvailableSessions({ serverName: "my-server", enabled: open });
 * data?.sessions // [{ sessionId: "abc123", serverName: "...", startTime: "...", endTime: "..." }, ...]
 */
export function useAvailableSessions(
  options: UseAvailableSessionsOptions = {},
) {
  const { serverName, enabled = true } = options;
  return useQuery({
    queryKey: ["sessions", serverName],
    queryFn: async () => await api.getSessions(serverName),
    refetchInterval: enabled ? 5000 : false, // Only refresh when enabled
    staleTime: 4000,
    enabled, // Control whether query runs
  });
}

interface UseAvailableServersOptions {
  /** Whether to fetch data (defaults to true) */
  enabled?: boolean;
}

/**
 * Fetch available servers
 *
 * Used in the Server filter submenu to show which servers are in the logs.
 *
 * @param options - Query options
 * @returns Query result with servers array
 *
 * @example
 * const { data, isLoading } = useAvailableServers({ enabled: open });
 * data?.servers // [{ name: "my-server", status: "online" }, ...]
 */
export function useAvailableServers(options: UseAvailableServersOptions = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => await api.getServers(),
    refetchInterval: enabled ? 5000 : false, // Only refresh when enabled
    staleTime: 4000,
    enabled, // Control whether query runs
  });
}

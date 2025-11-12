import type { ServerInfo } from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../lib/api";
import { POLLING_INTERVALS } from "../lib/constants";

/**
 * Hook to fetch all servers with health information
 *
 * Returns the query result with server list including health details.
 */
export function useServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: POLLING_INTERVALS.SERVERS,
  });
}

/**
 * Hook to fetch full server configurations (including headers)
 *
 * Use this for server management/editing where you need access to custom headers.
 * For display purposes, prefer useServers() which has health data but no sensitive headers.
 */
export function useServerConfigs() {
  return useQuery({
    queryKey: ["server-configs"],
    queryFn: () => api.getServerConfigs(),
    refetchInterval: POLLING_INTERVALS.SERVERS,
  });
}

/**
 * Hook to find a specific server by name (from aggregated stats)
 *
 * @param name Server name to look up
 * @returns The server if found, undefined otherwise
 */
export function useServerConfig(name: string) {
  const { data } = useServers();

  return useMemo(() => {
    return data?.servers.find((server) => server.name === name);
  }, [data?.servers, name]);
}

/**
 * Hook to find a specific full server config by name
 *
 * Use this when you need the full config including processState for stdio servers.
 *
 * @param name Server name to look up
 * @returns The full server config if found, undefined otherwise
 */
export function useFullServerConfig(name: string) {
  const { data } = useServerConfigs();

  return useMemo(() => {
    return data?.servers.find((server) => server.name === name);
  }, [data?.servers, name]);
}

/**
 * Hook to get a map of server names to their info
 *
 * @returns Map of server name to ServerInfo
 */
export function useServerMap() {
  const { data } = useServers();

  return useMemo(() => {
    const map = new Map<string, ServerInfo>();
    if (data?.servers) {
      for (const server of data.servers) {
        map.set(server.name, server);
      }
    }
    return map;
  }, [data?.servers]);
}

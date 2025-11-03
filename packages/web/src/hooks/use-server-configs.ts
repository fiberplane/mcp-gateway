import type { McpServer } from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../lib/api";

/**
 * Hook to fetch all server configurations
 *
 * Returns the query result with server configurations including full details.
 */
export function useServerConfigs() {
  return useQuery({
    queryKey: ["server-configs"],
    queryFn: () => api.getServerConfigs(),
  });
}

/**
 * Hook to find a specific server configuration by name
 *
 * @param name Server name to look up
 * @returns The server configuration if found, undefined otherwise
 */
export function useServerConfig(name: string) {
  const { data } = useServerConfigs();

  return useMemo(() => {
    return data?.servers.find((server) => server.name === name);
  }, [data?.servers, name]);
}

/**
 * Hook to get a map of server names to their configurations
 *
 * @returns Map of server name to McpServer configuration
 */
export function useServerConfigMap() {
  const { data } = useServerConfigs();

  return useMemo(() => {
    const map = new Map<string, McpServer>();
    if (data?.servers) {
      for (const server of data.servers) {
        map.set(server.name, server);
      }
    }
    return map;
  }, [data?.servers]);
}

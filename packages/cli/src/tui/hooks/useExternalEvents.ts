import { loadRegistry, logger } from "@fiberplane/mcp-gateway-core";
import type { LogEntry } from "@fiberplane/mcp-gateway-types";
import { useEffect } from "react";
import type { Action } from "../../events";
import { tuiEvents } from "../../events";
import { useAppStore } from "../store";

/**
 * Hook to listen to external events from the gateway server
 * - registry_updated: When servers are added/removed
 * - log_added: When MCP requests/responses occur
 */
export function useExternalEvents() {
  const storageDir = useAppStore((state) => state.storageDir);
  const setServers = useAppStore((state) => state.setServers);
  const addLog = useAppStore((state) => state.addLog);

  useEffect(() => {
    const handleLog = (entry: LogEntry) => {
      logger.debug("Log entry received", {
        method: entry.method,
        serverName: entry.serverName,
        httpStatus: entry.httpStatus,
      });
      addLog(entry);
    };

    const handleRegistryUpdate = async () => {
      logger.debug("Registry update event received, reloading from disk");

      // Reload registry from disk
      const updatedRegistry = await loadRegistry(storageDir);

      // Get current servers fresh from store (avoid stale closure)
      const currentServers = useAppStore.getState().servers;

      // Convert to UI servers, preserving health info from current state
      const updatedServers = updatedRegistry.servers.map((server) => {
        const currentServer = currentServers.find(
          (s) => s.name === server.name,
        );
        return {
          name: server.name,
          url: server.url,
          type: server.type,
          headers: server.headers,
          health: currentServer?.health ?? ("unknown" as const),
          lastHealthCheck: currentServer?.lastHealthCheck,
        };
      });

      logger.debug("Registry reloaded", {
        serverCount: updatedServers.length,
      });

      // Update UI state
      setServers(updatedServers);
    };

    const handleAction = (action: Action) => {
      if (action.type === "log_added") {
        handleLog(action.entry);
      } else if (action.type === "registry_updated") {
        handleRegistryUpdate();
      }
    };

    // Subscribe to events
    tuiEvents.on("action", handleAction);

    logger.debug("External events wired up");

    // Cleanup on unmount
    return () => {
      tuiEvents.off("action", handleAction);
      logger.debug("External events cleaned up");
    };
  }, [storageDir, setServers, addLog]);
}

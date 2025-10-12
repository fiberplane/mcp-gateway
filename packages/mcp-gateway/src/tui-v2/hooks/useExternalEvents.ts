import { useEffect } from "react";
import { logger } from "../../logger.js";
import { loadRegistry } from "../../storage";
import type { Action } from "../../tui/events";
import { tuiEvents } from "../../tui/events";
import type { LogEntry } from "../../tui/state";
import { useAppStore } from "../store";

/**
 * Hook to listen to external events from the gateway server
 * - registry_updated: When servers are added/removed
 * - log_added: When MCP requests/responses occur
 */
export function useExternalEvents() {
  const storageDir = useAppStore((state) => state.storageDir);
  const servers = useAppStore((state) => state.servers);
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

      // Convert to UI servers, preserving health info from current state
      const updatedServers = updatedRegistry.servers.map((server) => {
        const currentServer = servers.find((s) => s.name === server.name);
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
  }, [storageDir, servers, setServers, addLog]);
}

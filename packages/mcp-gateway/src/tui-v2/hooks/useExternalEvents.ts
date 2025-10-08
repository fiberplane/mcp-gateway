import { useEffect } from "react";
import { loadRegistry } from "../../storage";
import type { Action } from "../../tui/events";
import { tuiEvents } from "../../tui/events";
import type { LogEntry } from "../../tui/state";
import { debug } from "../debug";
import { useAppStore } from "../store";

/**
 * Hook to listen to external events from the gateway server
 * - registry_updated: When servers are added/removed
 * - log_added: When MCP requests/responses occur
 */
export function useExternalEvents() {
  const storageDir = useAppStore((state) => state.storageDir);
  const setRegistry = useAppStore((state) => state.setRegistry);
  const addLog = useAppStore((state) => state.addLog);

  useEffect(() => {
    const handleLog = (entry: LogEntry) => {
      debug("Log entry received:", {
        method: entry.method,
        serverName: entry.serverName,
        httpStatus: entry.httpStatus,
      });
      addLog(entry);
    };

    const handleRegistryUpdate = async () => {
      debug("Registry update event received, reloading from disk");
      // Get current registry to preserve runtime fields
      const currentRegistry = useAppStore.getState().registry;

      // Reload registry from disk
      const updatedRegistry = await loadRegistry(storageDir);

      // Preserve runtime fields (health, lastHealthCheck) that aren't persisted
      const mergedServers = updatedRegistry.servers.map((server) => {
        const currentServer = currentRegistry.servers.find(
          (s) => s.name === server.name,
        );
        if (currentServer) {
          return {
            ...server,
            health: currentServer.health,
            lastHealthCheck: currentServer.lastHealthCheck,
          };
        }
        return server;
      });

      debug("Registry reloaded:", {
        serverCount: mergedServers.length,
      });
      setRegistry({ servers: mergedServers });
    };

    // Subscribe to events
    tuiEvents.on("action", (action: Action) => {
      if (action.type === "log_added") {
        handleLog(action.entry);
      } else if (action.type === "registry_updated") {
        handleRegistryUpdate();
      }
    });

    debug("External events wired up");

    // Cleanup on unmount
    return () => {
      tuiEvents.removeListener("action", handleLog);
      tuiEvents.removeListener("action", handleRegistryUpdate);
      debug("External events cleaned up");
    };
  }, [storageDir, setRegistry, addLog]);
}

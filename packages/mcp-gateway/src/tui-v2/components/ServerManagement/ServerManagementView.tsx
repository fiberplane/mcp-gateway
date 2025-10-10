import { useAppStore } from "../../store";
import { ServerConfigExport } from "./ServerConfigExport";
import { ServerList } from "./ServerList";
import { useServerManagementKeys } from "./useServerManagementKeys";

/**
 * Main server management view with list and config export
 * Now uses Zustand store to persist state across view changes
 */
export function ServerManagementView() {
  const registry = useAppStore((state) => state.registry);
  const openModal = useAppStore((state) => state.openModal);
  const setServerToDelete = useAppStore((state) => state.setServerToDelete);
  const activeModal = useAppStore((state) => state.activeModal);

  // Get state from store
  const selectedIndex = useAppStore(
    (state) => state.serverManagementSelectedIndex,
  );
  const setSelectedIndex = useAppStore(
    (state) => state.setServerManagementSelectedIndex,
  );
  const showConfig = useAppStore((state) => state.serverManagementShowConfig);
  const setShowConfig = useAppStore(
    (state) => state.setServerManagementShowConfig,
  );

  const servers = registry.servers;

  // Keyboard navigation
  useServerManagementKeys({
    servers,
    selectedIndex,
    setSelectedIndex,
    showConfig,
    setShowConfig,
    activeModal,
    openModal,
    setServerToDelete,
  });

  // Show config export view
  if (showConfig) {
    const server = servers.find((s) => s.name === showConfig);
    if (!server) return null;

    return <ServerConfigExport server={server} />;
  }

  // Show server list view
  return (
    <ServerList
      servers={servers}
      selectedIndex={selectedIndex}
      showConfig={!!showConfig}
    />
  );
}

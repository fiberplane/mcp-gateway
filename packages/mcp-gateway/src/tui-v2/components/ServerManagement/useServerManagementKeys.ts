import { useKeyboard } from "@opentui/react";
import type { Server } from "./utils";

type ModalType =
  | "add-server"
  | "delete-server"
  | "server-details"
  | "mcp-instructions"
  | "activity-log-detail"
  | null;

interface KeyboardHandlerProps {
  servers: Server[];
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
  showConfig: string | null;
  setShowConfig: (serverName: string | null) => void;
  activeModal: string | null;
  openModal: (modal: ModalType) => void;
  setServerToDelete: (serverName: string) => void;
}

/**
 * Custom hook to handle keyboard navigation for server management
 */
export function useServerManagementKeys({
  servers,
  selectedIndex,
  setSelectedIndex,
  showConfig,
  setShowConfig,
  activeModal,
  openModal,
  setServerToDelete,
}: KeyboardHandlerProps) {
  useKeyboard((key) => {
    // Don't process keys if a modal is open
    if (activeModal) {
      return;
    }

    // If showing config, any key closes it
    if (showConfig) {
      setShowConfig(null);
      return;
    }

    // Normal navigation
    if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.name === "down") {
      setSelectedIndex((prev) => Math.min(servers.length - 1, prev + 1));
    } else if (key.name === "e" && servers[selectedIndex]) {
      setShowConfig(servers[selectedIndex].name);
    } else if (key.name === "d" && servers[selectedIndex]) {
      setServerToDelete(servers[selectedIndex].name);
      openModal("delete-server");
    } else if (key.name === "a") {
      openModal("add-server");
    }
  });
}

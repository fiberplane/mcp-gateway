import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { debug } from "../debug";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";

export function DeleteServerModal() {
  const theme = useTheme();
  const servers = useAppStore((state) => state.registry.servers);
  const removeServer = useAppStore((state) => state.removeServer);
  const closeModal = useAppStore((state) => state.closeModal);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle keyboard navigation
  useKeyboard((key) => {
    if (isDeleting) return; // Disable input while deleting

    if (showConfirm) {
      // Confirmation mode - Enter confirms, ESC cancels
      if (key.name === "return" || key.name === "enter") {
        const server = servers[selectedIndex];
        if (server) {
          setIsDeleting(true);
          debug("Deleting server", server.name);
          removeServer(server.name)
            .then(() => {
              debug("Server deleted successfully");
              closeModal();
            })
            .catch((err) => {
              debug("Error deleting server", err);
              setIsDeleting(false);
            });
        }
      }
      return;
    }

    // Selection mode - Arrow keys navigate, Enter confirms
    if (key.name === "up") {
      setSelectedIndex((prev) => (prev === 0 ? servers.length - 1 : prev - 1));
      return;
    }

    if (key.name === "down") {
      setSelectedIndex((prev) => (prev + 1) % servers.length);
      return;
    }

    if (key.name === "return" || key.name === "enter") {
      if (servers.length > 0) {
        setShowConfirm(true);
      }
    }
  });

  // Empty state
  if (servers.length === 0) {
    return (
      <Modal title="Delete MCP Server" onClose={closeModal}>
        <box style={{ flexDirection: "column" }}>
          <text fg={theme.foregroundMuted}>No servers to delete</text>
        </box>
      </Modal>
    );
  }

  const selectedServer = servers[selectedIndex];

  // Confirmation state
  if (showConfirm && selectedServer) {
    return (
      <Modal title="Confirm Deletion" onClose={closeModal}>
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text fg={theme.warning}>
            Really delete <text fg={theme.success}>{selectedServer.name}</text>?
          </text>
          <text fg={theme.foregroundMuted}>{selectedServer.url}</text>

          <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
            Note: Capture history will be preserved on disk
          </text>

          <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
            {isDeleting ? "Deleting..." : "[ENTER] Confirm • [ESC] Cancel"}
          </text>
        </box>
      </Modal>
    );
  }

  // Selection mode
  return (
    <Modal title="Delete MCP Server" onClose={closeModal}>
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text>Select a server to delete:</text>

        <box style={{ flexDirection: "column" }}>
          {servers.map((server, i) => (
            <text
              key={server.name}
              fg={i === selectedIndex ? theme.accentActive : theme.foreground}
            >
              {i === selectedIndex ? "→ " : "  "}
              {server.name} ({server.url})
            </text>
          ))}
        </box>

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [↑↓] Select • [ENTER] Delete • [ESC] Cancel
        </text>
      </box>
    </Modal>
  );
}

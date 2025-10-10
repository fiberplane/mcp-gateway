import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { logger } from "../../logger.js";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";
import { RoundedBox } from "./ui/RoundedBox";
import { SelectableList } from "./ui/SelectableList";

export function DeleteServerModal() {
  const theme = useTheme();
  const servers = useAppStore((state) => state.registry.servers);
  const removeServer = useAppStore((state) => state.removeServer);
  const closeModal = useAppStore((state) => state.closeModal);
  const serverToDelete = useAppStore((state) => state.serverToDelete);

  // If serverToDelete is set, find its index and go straight to confirmation
  const preselectedIndex = serverToDelete
    ? servers.findIndex((s) => s.name === serverToDelete)
    : -1;

  const [selectedIndex, setSelectedIndex] = useState(
    preselectedIndex >= 0 ? preselectedIndex : 0,
  );
  const [showConfirm, setShowConfirm] = useState(preselectedIndex >= 0);
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
          logger.debug("Deleting server", { serverName: server.name });
          removeServer(server.name)
            .then(() => {
              logger.debug("Server deleted successfully");
              closeModal();
            })
            .catch((err) => {
              logger.error("Error deleting server", { error: String(err) });
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
      <Modal
        title={`Delete Server ${selectedServer.name}`}
        onClose={closeModal}
      >
        <box style={{ flexDirection: "column", gap: 1 }}>
          <box>
            <text fg={theme.foreground}>
              Are you sure you want to delete{" "}
              <em fg={theme.warning}>{selectedServer.name}</em>?
            </text>
            <text fg={theme.warning}>This cannot be undone.</text>
          </box>
          <box>
            <text fg={theme.foregroundMuted}>
              The gateway forwarded requests to:
            </text>
            <RoundedBox style={{ marginTop: 1, padding: 0 }}>
              <text fg={theme.foregroundMuted}>{selectedServer.url}</text>
            </RoundedBox>
            <text fg={theme.foregroundMuted}>
              <em>Note:</em>
              The Capture history will be preserved
            </text>
          </box>

          <text fg={theme.foregroundMuted}>
            {isDeleting ? (
              "Deleting..."
            ) : (
              <span>
                <span fg={theme.danger}>
                  <strong>[ENTER]</strong> Confirm
                </span>
              </span>
            )}
          </text>
        </box>
      </Modal>
    );
  }

  // Selection mode
  return (
    <Modal title="Delete MCP Server" onClose={closeModal}>
      <box style={{ flexDirection: "column", gap: 1 }}>
        <text fg={theme.accent} style={{ marginBottom: 1 }}>
          Select a server to delete:
        </text>

        <SelectableList
          items={servers}
          selectedIndex={selectedIndex}
          getItemKey={(server) => server.name}
          renderItem={(server, isSelected) => (
            <>
              <text fg={isSelected ? theme.accent : theme.foreground}>
                {isSelected ? "> " : "  "}
                {server.name}
              </text>
              <text fg={theme.foregroundMuted} style={{ paddingLeft: 1 }}>
                ({server.url})
              </text>
            </>
          )}
        />

        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          [↑↓] Select • [ENTER] Delete • [ESC] Cancel
        </text>
      </box>
    </Modal>
  );
}

import { COLORS } from "../colors";
import { useAppStore } from "../store";
import { Modal } from "./Modal";

export function DeleteServerModal() {
  const servers = useAppStore((state) => state.registry.servers);
  const closeModal = useAppStore((state) => state.closeModal);

  return (
    <Modal title="Delete MCP Server" onClose={closeModal}>
      <box style={{ flexDirection: "column" }}>
        {servers.length === 0 ? (
          <text fg={COLORS.GRAY}>No servers to delete</text>
        ) : (
          <>
            <text fg={COLORS.CYAN}>
              To delete a server, edit your registry configuration:
            </text>

            <text style={{ marginTop: 1 }}>Current servers:</text>
            <box
              style={{ flexDirection: "column", marginTop: 0, marginLeft: 2 }}
            >
              {servers.map((server) => (
                <text key={server.name} fg={COLORS.YELLOW}>
                  • {server.name} ({server.url})
                </text>
              ))}
            </box>

            <text style={{ marginTop: 1 }}>1. Quit the TUI (press 'q')</text>
            <text>2. Edit ~/.mcp-gateway/registry.json</text>
            <text>3. Remove the server entry</text>
            <text>4. Restart the gateway</text>

            <text fg={COLORS.GRAY} style={{ marginTop: 2 }}>
              Note: Interactive deletion coming in a future update
            </text>
          </>
        )}
      </box>
    </Modal>
  );
}

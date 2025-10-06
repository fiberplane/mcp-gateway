import { COLORS } from "../colors";
import { useAppStore } from "../store";
import { Modal } from "./Modal";

export function AddServerModal() {
  const closeModal = useAppStore((state) => state.closeModal);

  return (
    <Modal title="Add MCP Server" onClose={closeModal}>
      <box style={{ flexDirection: "column" }}>
        <text fg={COLORS.CYAN}>
          To add a server, edit your registry configuration:
        </text>

        <text style={{ marginTop: 1 }}>1. Quit the TUI (press 'q')</text>
        <text>2. Edit ~/.mcp-gateway/registry.json</text>
        <text>3. Add your server configuration:</text>

        <box
          style={{
            flexDirection: "column",
            marginTop: 0,
            marginLeft: 2,
            padding: 1,
          }}
        >
          <text fg={COLORS.GRAY}>{"{"}</text>
          <text fg={COLORS.GRAY}> "servers": [</text>
          <text fg={COLORS.YELLOW}> {"{"}</text>
          <text fg={COLORS.GREEN}> "name": "my-server",</text>
          <text fg={COLORS.GREEN}> "url": "http://localhost:3000/mcp",</text>
          <text fg={COLORS.GREEN}> "type": "http"</text>
          <text fg={COLORS.YELLOW}> {"}"}</text>
          <text fg={COLORS.GRAY}> ]</text>
          <text fg={COLORS.GRAY}>{"}"}</text>
        </box>

        <text style={{ marginTop: 1 }}>4. Restart the gateway</text>

        <text fg={COLORS.GRAY} style={{ marginTop: 2 }}>
          Note: Interactive form input coming in a future update
        </text>
      </box>
    </Modal>
  );
}

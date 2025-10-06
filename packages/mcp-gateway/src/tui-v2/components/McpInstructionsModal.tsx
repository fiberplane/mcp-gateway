import { COLORS } from "../colors";
import { useAppStore } from "../store";
import { Modal } from "./Modal";

export function McpInstructionsModal() {
  const closeModal = useAppStore((state) => state.closeModal);

  return (
    <Modal title="MCP Client Configuration" onClose={closeModal}>
      <box style={{ flexDirection: "column" }}>
        <text fg={COLORS.CYAN}>
          To connect an MCP client (like Claude Desktop) to this gateway:
        </text>

        <text style={{ marginTop: 1 }}>1. Add to your MCP client config:</text>
        <box
          style={{
            flexDirection: "column",
            marginTop: 0,
            marginLeft: 2,
            padding: 1,
          }}
        >
          <text fg={COLORS.GRAY}>{"{"}</text>
          <text fg={COLORS.GRAY}> "mcpServers": {"{"}</text>
          <text fg={COLORS.YELLOW}> "gateway": {"{"}</text>
          <text fg={COLORS.GREEN}>
            {`      "url": "http://localhost:3333/sse",`}
          </text>
          <text fg={COLORS.GREEN}> "transport": "sse"</text>
          <text fg={COLORS.YELLOW}> {"}"}</text>
          <text fg={COLORS.GRAY}> {"}"}</text>
          <text fg={COLORS.GRAY}>{"}"}</text>
        </box>

        <text style={{ marginTop: 1 }}>
          2. The gateway will proxy requests to your configured MCP servers
        </text>

        <text style={{ marginTop: 1 }}>
          3. Add servers using the 'a' key in this interface
        </text>

        <text fg={COLORS.GRAY} style={{ marginTop: 2 }}>
          For more information, visit: https://github.com/fiberplane/mcp-gateway
        </text>
      </box>
    </Modal>
  );
}

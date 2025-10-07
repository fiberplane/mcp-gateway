import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";

export function McpInstructionsModal() {
  const closeModal = useAppStore((state) => state.closeModal);
  const theme = useTheme();

  return (
    <Modal title="MCP Client Configuration" onClose={closeModal}>
      <box style={{ flexDirection: "column" }}>
        <text fg={theme.accent}>
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
          <text fg={theme.syntaxPunctuation}>{"{"}</text>
          <text fg={theme.syntaxPunctuation}> "mcpServers": {"{"}</text>
          <text fg={theme.syntaxKey}> "gateway": {"{"}</text>
          <text fg={theme.syntaxString}>
            {`      "url": "http://localhost:3333/sse",`}
          </text>
          <text fg={theme.syntaxString}> "transport": "sse"</text>
          <text fg={theme.syntaxKey}> {"}"}</text>
          <text fg={theme.syntaxPunctuation}> {"}"}</text>
          <text fg={theme.syntaxPunctuation}>{"}"}</text>
        </box>

        <text style={{ marginTop: 1 }}>
          2. The gateway will proxy requests to your configured MCP servers
        </text>

        <text style={{ marginTop: 1 }}>
          3. Add servers using the 'a' key in this interface
        </text>

        <text fg={theme.foregroundMuted} style={{ marginTop: 2 }}>
          For more information, visit: https://github.com/fiberplane/mcp-gateway
        </text>
      </box>
    </Modal>
  );
}

import { useAppStore } from "../../store";
import { useTheme } from "../../theme-context";
import { CodeBlock } from "../ui/CodeBlock";
import type { Server } from "./utils";
import { generateMcpConfig } from "./utils";

interface ServerConfigExportProps {
  server: Server;
}

/**
 * View for exporting server configuration for Claude Desktop
 */
export function ServerConfigExport({ server }: ServerConfigExportProps) {
  const theme = useTheme();
  const port = useAppStore((state) => state.port);
  const config = generateMcpConfig(server, port);

  return (
    <box
      style={{
        flexDirection: "column",
        flexGrow: 1,
        padding: 0,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {/* Header */}
      <box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          backgroundColor: theme.background,
          padding: 0,
          paddingLeft: 1,
          paddingRight: 1,
          border: ["bottom"],
          borderColor: theme.border,
        }}
      >
        <text fg={theme.accent}>Export Config</text>
        <text fg={theme.foregroundMuted}>[{server.name}]</text>
      </box>

      {/* Content */}
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <text style={{ marginBottom: 1 }}>
          Copy this configuration to your Claude Desktop config:
        </text>

        <CodeBlock content={config} style={{ marginBottom: 1 }} />
      </box>

      {/* Footer */}
      <box
        style={{
          paddingTop: 1,
          border: ["top"],
          borderColor: theme.border,
        }}
      >
        <text fg={theme.foregroundMuted}>
          Press any key to go back • [ESC] Return to Activity Log
        </text>
      </box>
    </box>
  );
}

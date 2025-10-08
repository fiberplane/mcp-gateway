import { useKeyboard } from "@opentui/react";
import { useState } from "react";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

type Server = {
  name: string;
  url: string;
  type: string;
  headers: Record<string, string>;
  lastActivity: string | null;
  exchangeCount: number;
  health?: string;
  lastHealthCheck?: string;
};

function getStatusText(health?: string): string {
  switch (health) {
    case "up":
      return "✓ up";
    case "down":
      return "✗ down";
    default:
      return "? unknown";
  }
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "—";
  }
}

function generateMcpConfig(server: Server): string {
  const encodedName = encodeURIComponent(server.name);
  const gatewayUrl = `http://localhost:3333/servers/${encodedName}/mcp`;

  return JSON.stringify(
    {
      mcpServers: {
        [server.name]: {
          transport: "sse",
          url: gatewayUrl,
        },
      },
    },
    null,
    2,
  );
}

export function ServerManagementView() {
  const theme = useTheme();
  const registry = useAppStore((state) => state.registry);
  const openModal = useAppStore((state) => state.openModal);
  const setServerToDelete = useAppStore((state) => state.setServerToDelete);
  const activeModal = useAppStore((state) => state.activeModal);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showConfig, setShowConfig] = useState<string | null>(null);

  const servers = registry.servers;

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

  // Show config export view
  if (showConfig) {
    const server = servers.find((s) => s.name === showConfig);
    if (!server) return null;

    const config = generateMcpConfig(server);

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

          <box
            style={{
              flexDirection: "column",
              padding: 1,
              marginBottom: 1,
            }}
            backgroundColor={theme.emphasis}
          >
            {config.split("\n").map((line, i) => (
              <text key={i} fg={theme.foreground}>
                {line}
              </text>
            ))}
          </box>
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

  return (
    <box
      style={{
        flexDirection: "column",
        flexGrow: 1,
        padding: 0,
        paddingLeft: 1,
        paddingRight: 1,
        // backgroundColor: theme.accent
      }}
    >
      {/* Header */}
      <box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          border: ["bottom"],
          borderColor: theme.border,
        }}
      >
        <text fg={theme.accent}>Server Management</text>
        <text fg={theme.foregroundMuted}>
          [{servers.length} {servers.length === 1 ? "server" : "servers"}]
        </text>
      </box>

      {/* Content */}
      <box style={{ flexDirection: "column", flexGrow: 1, padding: 0 }}>
        {servers.length === 0 ? (
          <box
            style={{
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
            }}
          >
            <text fg={theme.foregroundMuted} style={{ marginBottom: 2 }}>
              <em>No servers registered yet.</em>
            </text>
            <text fg={theme.accent}>Press [a] to add your first server</text>
          </box>
        ) : (
          <scrollbox
            scrollY={true}
            focused={!showConfig}
            style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}
          >
            {servers.map((server, index) => {
              const isSelected = index === selectedIndex;
              return (
                <ServerOption
                  key={server.name}
                  server={server}
                  isSelected={isSelected}
                />
              );
            })}
          </scrollbox>
        )}
      </box>

      {/* Footer */}
      <box
        style={{
          flexDirection: "column",
          paddingTop: 1,
          border: ["top"],
          borderColor: theme.border,
        }}
      >
        <text fg={theme.foregroundMuted}>
          [↑↓] Select • [e] Export • [d] Delete • [a] Add • [ESC] Back to
          Activity Log
        </text>
      </box>
    </box>
  );
}

function ServerOption({
  server,
  isSelected,
}: {
  server: Server;
  isSelected?: boolean;
}) {
  const theme = useTheme();
  const getHealthColor = (health?: string) => {
    switch (health) {
      case "up":
        return theme.success;
      case "down":
        return theme.danger;
      default:
        return theme.foregroundMuted;
    }
  };

  const healthColor = getHealthColor(server.health);
  const statusText = getStatusText(server.health);
  const encodedName = encodeURIComponent(server.name);
  const gatewayUrl = `http://localhost:3333/servers/${encodedName}/mcp`;
  const activityTime = formatRelativeTime(server.lastActivity);

  return (
    <box
      style={{
        flexDirection: "row",
        gap: 1,
        backgroundColor: isSelected ? theme.emphasis : undefined,
      }}
    >
      <box>
        <text
          fg={isSelected ? theme.accent : theme.foreground}
          style={{ width: 1 }}
        >
          {isSelected ? ">" : " "}
        </text>
      </box>

      <box
        key={server.name}
        style={{
          flexDirection: "column",
          // padding: 1,
          // marginBottom: 1,
        }}
      >
        {/* Server name and status */}
        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg={healthColor}>{statusText}</text>
          <text fg={theme.foreground}>{server.name}</text>
        </box>

        {/* Source URL */}
        <text
          fg={theme.foregroundMuted}
          style={{ paddingLeft: 2, marginTop: 0 }}
        >
          Source: {server.url}
        </text>

        {/* Gateway URL */}
        <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
          Gateway: {gatewayUrl}
        </text>

        {/* Health check info for down servers */}
        {server.health === "down" && server.lastHealthCheck && (
          <text fg={theme.danger} style={{ paddingLeft: 2 }}>
            Server unreachable (checked{" "}
            {formatRelativeTime(server.lastHealthCheck)})
          </text>
        )}

        {/* Activity info */}
        {server.lastActivity && (
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            Last activity: {activityTime} • {server.exchangeCount} exchanges
          </text>
        )}

        {/* Actions (only show for selected) */}
        {isSelected && (
          <text fg={theme.accent} style={{ paddingLeft: 2, marginTop: 1 }}>
            [e] Export config [d] Delete server
          </text>
        )}
      </box>
    </box>
  );
}

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
  const removeServer = useAppStore((state) => state.removeServer);
  const openModal = useAppStore((state) => state.openModal);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showConfig, setShowConfig] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const servers = registry.servers;

  useKeyboard((key) => {
    // If showing config, any key closes it
    if (showConfig) {
      setShowConfig(null);
      return;
    }

    // If confirming delete, handle y/n
    if (deleteConfirm) {
      if (key.name === "y") {
        removeServer(deleteConfirm);
        setDeleteConfirm(null);
      } else if (key.name === "n" || key.name === "escape") {
        setDeleteConfirm(null);
      }
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
      setDeleteConfirm(servers[selectedIndex].name);
    } else if (key.name === "a") {
      openModal("add-server");
    }
  });

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
          padding: 1,
        }}
      >
        {/* Header */}
        <box
          style={{
            flexDirection: "row",
            justifyContent: "center",
            paddingBottom: 1,
            border: ["bottom"],
            borderColor: theme.border,
            marginBottom: 1,
          }}
        >
          <text fg={theme.accent}>Export Config: {server.name}</text>
        </box>

        {/* Content */}
        <box style={{ flexDirection: "column", flexGrow: 1 }}>
          <text fg={theme.accent} style={{ marginBottom: 1 }}>
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
        padding: 1,
      }}
    >
      {/* Header */}
      <box
        style={{
          flexDirection: "row",
          justifyContent: "center",
          paddingBottom: 1,
          border: ["bottom"],
          borderColor: theme.border,
          marginBottom: 1,
        }}
      >
        <text fg={theme.accent}>Server Management</text>
      </box>

      {/* Content */}
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {servers.length === 0 ? (
          <>
            <text fg={theme.foregroundMuted} style={{ marginBottom: 2 }}>
              No servers registered yet.
            </text>
            <text fg={theme.accent}>Press [a] to add your first server</text>
          </>
        ) : (
          <>
            <text fg={theme.accent} style={{ marginBottom: 1 }}>
              Registered Servers ({servers.length}):
            </text>

            {servers.map((server, index) => {
              const isSelected = index === selectedIndex;
              const healthColor = getHealthColor(server.health);
              const statusText = getStatusText(server.health);
              const encodedName = encodeURIComponent(server.name);
              const gatewayUrl = `http://localhost:3333/servers/${encodedName}/mcp`;
              const activityTime = formatRelativeTime(server.lastActivity);

              return (
                <box
                  key={server.name}
                  style={{
                    flexDirection: "column",
                    padding: 1,
                    marginBottom: 1,
                    backgroundColor: isSelected ? theme.emphasis : undefined,
                  }}
                >
                  {/* Server name and status */}
                  <box style={{ flexDirection: "row", gap: 1 }}>
                    <text fg={isSelected ? theme.accent : theme.foreground}>
                      {isSelected ? ">" : " "}
                    </text>
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
                      Last activity: {activityTime} • {server.exchangeCount}{" "}
                      exchanges
                    </text>
                  )}

                  {/* Actions (only show for selected, not when confirming delete) */}
                  {isSelected && deleteConfirm !== server.name && (
                    <text
                      fg={theme.accent}
                      style={{ paddingLeft: 2, marginTop: 1 }}
                    >
                      [e] Export config [d] Delete server
                    </text>
                  )}
                </box>
              );
            })}
          </>
        )}
      </box>

      {/* Footer - Delete confirmation or normal navigation */}
      <box
        style={{
          flexDirection: "column",
          paddingTop: 1,
          border: ["top"],
          borderColor: deleteConfirm ? theme.danger : theme.border,
        }}
      >
        {deleteConfirm ? (
          <>
            <text fg={theme.danger}>
              ⚠ Delete '{deleteConfirm}'? This cannot be undone.
            </text>
            <text fg={theme.accent}>[y] Yes [n] No</text>
          </>
        ) : (
          <>
            <text fg={theme.foregroundMuted}>
              [↑↓] Select • [e] Export • [d] Delete • [a] Add • [ESC] Back to
              Activity Log
            </text>
          </>
        )}
      </box>
    </box>
  );
}

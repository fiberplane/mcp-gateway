import packageJson from "../../../package.json" with { type: "json" };
import type { ServerHealth } from "../../registry";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

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

export function Header() {
  const theme = useTheme();
  const registry = useAppStore((state) => state.registry);

  const getHealthColor = (health?: ServerHealth): string => {
    switch (health) {
      case "up":
        return theme.success;
      case "down":
        return theme.danger;
      default:
        return theme.foregroundMuted;
    }
  };

  return (
    <box style={{ flexDirection: "column" }}>
      {/* Centered title */}
      <box
        style={{
          flexDirection: "row",
          justifyContent: "center",
          border: true,
          borderColor: theme.border,
        }}
      >
        <text fg={theme.brand}>
          Fiberplane MCP Gateway v{packageJson.version}
        </text>
      </box>

      {/* Two-column layout: Details | Servers */}
      <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
        {/* Left column: Gateway details */}
        <box
          style={{
            flexDirection: "column",
            width: "50%",
            border: ["right"],
            borderColor: theme.border,
            paddingRight: 1,
          }}
        >
          <box style={{ flexDirection: "row", gap: 1 }}>
            <box style={{ flexDirection: "column" }}>
              <text fg={theme.foregroundMuted}>Gateway:</text>
              <text fg={theme.foregroundMuted}>MCP:</text>
            </box>
            <box style={{ flexDirection: "column" }}>
              <text fg={theme.foreground}>http://localhost:3333</text>
              <text fg={theme.foreground}>
                http://localhost:3333/gateway/mcp
              </text>
            </box>
          </box>
        </box>

        {/* Right column: Server list */}
        <box style={{ flexDirection: "column", width: "50%", paddingLeft: 1 }}>
          {registry.servers.length === 0 ? (
            <text fg={theme.foregroundMuted}>No servers registered</text>
          ) : (
            <>
              <text fg={theme.accent}>Servers:</text>
              {registry.servers.map((server) => {
                const healthColor = getHealthColor(server.health);
                const encodedName = encodeURIComponent(server.name);
                const proxyUrl = `http://localhost:3333/servers/${encodedName}/mcp`;
                const activityTime = formatRelativeTime(server.lastActivity);
                const activityText = `Last: ${activityTime} • ${server.exchangeCount} exchanges`;

                return (
                  <box
                    key={server.name}
                    style={{ flexDirection: "column", marginTop: 1 }}
                  >
                    {/* Line 1: Health • Name • Activity */}
                    <box style={{ flexDirection: "row", gap: 1 }}>
                      <text fg={healthColor}>●</text>
                      <text fg={healthColor}>{server.name}</text>
                      <text fg={theme.foregroundMuted}>{activityText}</text>
                    </box>
                    {/* Line 2: Proxy URL */}
                    <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
                      → {proxyUrl}
                    </text>
                  </box>
                );
              })}
            </>
          )}
        </box>
      </box>
    </box>
  );
}

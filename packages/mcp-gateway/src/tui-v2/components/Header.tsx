import type { BoxProps } from "@opentui/react";
import packageJson from "../../../package.json" with { type: "json" };
import type { ServerHealth } from "@fiberplane/mcp-gateway-types";
import { useCompactHeight } from "../hooks/useCompactHeight";
import type { UIServer } from "../store";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

export function Header() {
  const theme = useTheme();
  const servers = useAppStore((state) => state.servers);
  const port = useAppStore((state) => state.port);

  return (
    <box style={{ flexDirection: "column", flexShrink: 0 }}>
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
          <strong>Fiberplane</strong> MCP Gateway v{packageJson.version}
        </text>
      </box>

      {/* Two-column layout: Details | Servers */}
      <box style={{ flexDirection: "row", flexShrink: 0 }}>
        {/* Left column: Gateway details */}
        <HeaderSection
          title="Status:"
          style={{
            width: "50%",
            border: ["right", "left"],
            borderColor: theme.border,
            gap: 1,
          }}
        >
          <text fg={theme.foregroundMuted}>Running server on port {port}.</text>
        </HeaderSection>
        {/* Right column: Server list */}
        <HeaderSection
          title={`Servers (${servers.length}):`}
          style={{
            width: "50%",
          }}
        >
          {servers.length === 0 ? (
            <text fg={theme.foregroundMuted}>No servers registered</text>
          ) : (
            <box style={{ flexShrink: 0 }}>
              {servers.map((server) => (
                <ServerEntry key={server.name} server={server} />
              ))}
            </box>
          )}
        </HeaderSection>
      </box>
    </box>
  );
}

function HeaderSection({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: BoxProps["style"];
}) {
  const theme = useTheme();
  const compactHeight = useCompactHeight();

  return (
    <box
      style={{
        flexDirection: "column",
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: compactHeight.enabled ? 0 : 1,
        ...style,
      }}
    >
      <text fg={theme.foreground}>{title}</text>
      {children}
    </box>
  );
}

function ServerEntry({ server }: { server: UIServer }) {
  const theme = useTheme();
  const getHealthColor = (health?: ServerHealth) => {
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
  const statusText =
    server.health === "up"
      ? "up"
      : server.health === "down"
        ? "down"
        : "<unknown>";

  return (
    <box
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={healthColor}>
          {!server.health || server.health === "unknown" ? (
            <>&#x25CB;</>
          ) : (
            <>&#x25CF;</>
          )}
        </text>
        <text fg={theme.foreground}>{server.name}</text>
        <text fg={theme.foregroundSubtle}>(status: {statusText})</text>
      </box>
    </box>
  );
}

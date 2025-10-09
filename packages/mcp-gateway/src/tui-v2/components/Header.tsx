import type { BoxProps } from "@opentui/react";
import packageJson from "../../../package.json" with { type: "json" };
import type { McpServer, ServerHealth } from "../../registry";
import { useIsSmall } from "../hooks/useIsSmall";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

// function formatRelativeTime(timestamp: string | null): string {
//   if (!timestamp) return "—";
//   try {
//     const date = new Date(timestamp);
//     const now = new Date();
//     const diffMs = now.getTime() - date.getTime();
//     const diffSecs = Math.floor(diffMs / 1000);
//     const diffMins = Math.floor(diffSecs / 60);
//     const diffHours = Math.floor(diffMins / 60);
//     const diffDays = Math.floor(diffHours / 24);

//     if (diffSecs < 60) return "just now";
//     if (diffMins < 60) return `${diffMins}m ago`;
//     if (diffHours < 24) return `${diffHours}h ago`;
//     if (diffDays < 7) return `${diffDays}d ago`;
//     return date.toISOString().slice(0, 16).replace("T", " ");
//   } catch {
//     return "—";
//   }
// }

export function Header() {
  const theme = useTheme();
  const registry = useAppStore((state) => state.registry);

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
          <text fg={theme.foregroundMuted}>Running server on port 3333.</text>
        </HeaderSection>
        {/* Right column: Server list */}
        <HeaderSection
          title={`Servers (${registry.servers.length}):`}
          style={{
            width: "50%",
          }}
        >
          {registry.servers.length === 0 ? (
            <text fg={theme.foregroundMuted}>No servers registered</text>
          ) : (
            <box style={{ flexShrink: 0 }}>
              {registry.servers.map((server) => (
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
  const isSmall = useIsSmall();
  // const
  return (
    <box
      style={{
        flexDirection: "column",
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
        paddingBottom: isSmall ? 0 : 1,
        ...style,
      }}
    >
      <text fg={theme.foreground}>{title}</text>
      {children}
    </box>
  );
}

function ServerEntry({ server }: { server: McpServer }) {
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

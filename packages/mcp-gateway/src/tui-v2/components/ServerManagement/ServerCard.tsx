import { useTheme } from "../../theme-context";
import type { Server } from "./utils";
import { formatRelativeTime, getGatewayUrl, getStatusText } from "./utils";

interface ServerCardProps {
  server: Server;
  isSelected?: boolean;
}

/**
 * Card component displaying server details
 */
export function ServerCard({ server, isSelected }: ServerCardProps) {
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
  const gatewayUrl = getGatewayUrl(server.name);
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

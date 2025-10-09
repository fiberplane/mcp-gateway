import { type BoxProps, useTerminalDimensions } from "@opentui/react";
import { debug } from "../debug";
import { useIsSmall } from "../hooks/useIsSmall";
import { commandShortcuts, formatShortcut } from "../shortcuts";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { RoundedBox } from "./ui/RoundedBox";

export function EmptyState() {
  const theme = useTheme();
  const registry = useAppStore((state) => state.registry);

  const hasServers = registry.servers.length > 0;
  const firstServer = registry.servers[0];

  return (
    <box
      style={{
        flexDirection: "column",
        flexGrow: 1,
      }}
    >
      {/* Header with title */}
      <box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingLeft: 1,
          paddingRight: 1,
          flexGrow: 0,
          border: ["bottom"],
          borderColor: theme.border,
        }}
      >
        <text fg={theme.accent}>Recent Activity</text>
      </box>

      {/* Empty state content */}
      <box
        style={{
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
          gap: 1,
          flexShrink: 0,
        }}
      >
        {!hasServers ? (
          // No servers configured
          <>
            <text fg={theme.foregroundMuted}>
              <em>No servers configured</em>
            </text>
            <RoundedBox style={{ borderColor: theme.accent }}>
              <text fg={theme.foreground}>
                Add an MCP server to get started
              </text>
              <box style={{ flexDirection: "column", gap: 0 }}>
                <text fg={theme.foregroundMuted}>
                  <strong>
                    {formatShortcut(commandShortcuts.addServer.key)}
                  </strong>{" "}
                  Add Server
                </text>
                <text fg={theme.foregroundMuted}>
                  {formatShortcut(commandShortcuts.help.key)} Setup Guide
                </text>
              </box>
            </RoundedBox>
          </>
        ) : registry.servers.length === 1 && firstServer ? (
          // Single server - show direct URL
          <>
            <text fg={theme.foregroundMuted}>
              <em>Waiting for activity...</em>
            </text>
            <RoundedBox>
              <box style={{ flexDirection: "column", gap: 0 }}>
                <text fg={theme.foregroundMuted}>Configured server:</text>
                <text fg={theme.accent}>{firstServer.name}</text>
              </box>

              <box style={{ flexDirection: "column", gap: 0 }}>
                <text fg={theme.foregroundMuted}>
                  Make sure you configure your client to use mcp server through
                  this service:
                </text>
                <text fg={theme.accent}>
                  http://localhost:3333/servers/
                  {encodeURIComponent(firstServer.name)}
                  /mcp
                </text>
              </box>
              <box style={{ flexDirection: "column", gap: 0 }}>
                <text fg={theme.foregroundMuted}>See also:</text>
                <text fg={theme.foregroundMuted}>
                  • <strong>{formatShortcut(commandShortcuts.help.key)}</strong>{" "}
                  Client Setup Examples
                </text>
                <text fg={theme.foregroundMuted}>
                  •{" "}
                  <strong>
                    {formatShortcut(commandShortcuts.serverManagement.key)}
                  </strong>{" "}
                  Manage Servers
                </text>
              </box>
            </RoundedBox>
          </>
        ) : (
          // Multiple servers - point to help
          <>
            <text fg={theme.foregroundMuted}>
              <em>Waiting for activity...</em>
            </text>
            <RoundedBox style={{ maxWidth: 66 }}>
              <box>
                <text fg={theme.foreground}>
                  {registry.servers.length} servers are configured for this
                  gateway
                </text>
                <text fg={theme.foregroundMuted}>
                  Press{" "}
                  <strong>{formatShortcut(commandShortcuts.help.key)}</strong>{" "}
                  for setup examples for each server
                </text>
              </box>
              <box>
                <text fg={theme.foregroundMuted}>Related commands:</text>
                <text fg={theme.foregroundMuted}>
                  • <strong>{formatShortcut(commandShortcuts.help.key)}</strong>{" "}
                  Client Setup Examples
                </text>
                <text fg={theme.foregroundMuted}>
                  •{" "}
                  <strong>
                    {formatShortcut(commandShortcuts.serverManagement.key)}
                  </strong>{" "}
                  Manage Servers
                </text>
              </box>
            </RoundedBox>
          </>
        )}
      </box>
    </box>
  );
}

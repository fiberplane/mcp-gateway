import { COLORS } from "../colors";
import { useAppStore } from "../store";

export function Footer() {
  const hasServers = useAppStore((state) => state.registry.servers.length > 0);
  const hasLogs = useAppStore((state) => state.logs.length > 0);

  return (
    <box style={{ flexDirection: "column" }}>
      {/* Add server - always active */}
      <box style={{ flexDirection: "row" }}>
        <text fg={COLORS.YELLOW}>[a]</text>
        <text> Add server</text>
      </box>

      {/* Delete server - only active if servers exist */}
      <box style={{ flexDirection: "row" }}>
        <text fg={hasServers ? COLORS.YELLOW : COLORS.GRAY}>[d]</text>
        <text fg={hasServers ? COLORS.WHITE : COLORS.GRAY}> Delete server</text>
      </box>

      {/* Clear activity - only active if logs exist */}
      <box style={{ flexDirection: "row" }}>
        <text fg={hasLogs ? COLORS.YELLOW : COLORS.GRAY}>[c]</text>
        <text fg={hasLogs ? COLORS.WHITE : COLORS.GRAY}> Clear activity</text>
      </box>

      {/* MCP instructions - always active */}
      <box style={{ flexDirection: "row" }}>
        <text fg={COLORS.YELLOW}>[m]</text>
        <text> MCP instructions</text>
      </box>

      {/* Quit - always active */}
      <box style={{ flexDirection: "row" }}>
        <text fg={COLORS.YELLOW}>[q]</text>
        <text> Quit</text>
      </box>
    </box>
  );
}

import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

export function Footer() {
  const theme = useTheme();
  const hasServers = useAppStore((state) => state.registry.servers.length > 0);
  const hasLogs = useAppStore((state) => state.logs.length > 0);

  const keyColor = (disabled: boolean) =>
    disabled ? theme.brandForeground : theme.foregroundMuted;
  const labelColor = (disabled: boolean) =>
    disabled ? theme.brandForeground : theme.foregroundMuted;

  return (
    <box
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
      backgroundColor={theme.brand}
    >
      {/* Left: Clear logs */}
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={keyColor(!hasLogs)}>[c]</text>
        <text fg={labelColor(!hasLogs)}>Clear logs</text>
      </box>

      {/* Center: Server actions */}
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={theme.brandForeground}>Servers:</text>
        <text fg={keyColor(false)}>
          [a]
        </text>
        <text fg={labelColor(false)}>Add</text>
        <text fg={keyColor(!hasServers)}>[d]</text>
        <text fg={labelColor(!hasServers)}>Delete</text>
      </box>

      {/* Right: Info and Quit */}
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={keyColor(false)}>[m]</text>
        <text fg={labelColor(false)}>Info</text>
        <text fg={keyColor(false)}>[q]</text>
        <text fg={labelColor(false)}>Quit</text>
      </box>
    </box>
  );
}

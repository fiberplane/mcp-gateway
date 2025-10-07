import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

export function ServerList() {
  const registry = useAppStore((state) => state.registry);
  const theme = useTheme();

  if (registry.servers.length === 0) {
    return <text fg={theme.foregroundMuted}>No servers registered</text>;
  }

  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent}>Servers:</text>
      {registry.servers.map((server) => (
        <box
          key={server.name}
          style={{ flexDirection: "column", marginTop: 1 }}
        >
          <text fg={theme.success}>● {server.name}</text>
          <text fg={theme.foregroundMuted}>{server.url}</text>
        </box>
      ))}
    </box>
  );
}

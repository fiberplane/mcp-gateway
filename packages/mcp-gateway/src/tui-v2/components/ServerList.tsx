import { COLORS } from "../colors";
import { useAppStore } from "../store";

export function ServerList() {
  const registry = useAppStore((state) => state.registry);

  if (registry.servers.length === 0) {
    return <text fg={COLORS.GRAY}>No servers registered</text>;
  }

  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={COLORS.CYAN}>Servers:</text>
      {registry.servers.map((server) => (
        <box
          key={server.name}
          style={{ flexDirection: "column", marginTop: 1 }}
        >
          <text fg={COLORS.GREEN}>� {server.name}</text>
          <text fg={COLORS.GRAY}>{server.url}</text>
        </box>
      ))}
    </box>
  );
}

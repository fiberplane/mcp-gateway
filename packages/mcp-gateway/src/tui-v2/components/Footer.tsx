import { useAppStore } from "../store";
import { FooterItem } from "./FooterItem";

export function Footer() {
  const hasServers = useAppStore((state) => state.registry.servers.length > 0);
  const hasLogs = useAppStore((state) => state.logs.length > 0);

  return (
    <box style={{ flexDirection: "column" }}>
      <FooterItem shortcutKey="a" label="Add server" />
      <FooterItem
        shortcutKey="d"
        label="Delete server"
        disabled={!hasServers}
      />
      <FooterItem shortcutKey="c" label="Clear activity" disabled={!hasLogs} />
      <FooterItem shortcutKey="m" label="MCP instructions" />
      <FooterItem shortcutKey="q" label="Quit" />
    </box>
  );
}

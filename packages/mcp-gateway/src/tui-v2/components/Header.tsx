import packageJson from "../../../package.json" with { type: "json" };
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

export function Header() {
  const theme = useTheme();
  const registry = useAppStore((state) => state.registry);

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
              {registry.servers.map((server) => (
                <box key={server.name} style={{ flexDirection: "column" }}>
                  <text fg={theme.success}>◆ {server.name}</text>
                  <text fg={theme.foregroundMuted} paddingLeft={3}>
                    {server.url}
                  </text>
                </box>
              ))}
            </>
          )}
        </box>
      </box>
    </box>
  );
}

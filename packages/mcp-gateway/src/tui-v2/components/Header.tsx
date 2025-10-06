import packageJson from "../../../package.json" with { type: "json" };
import { useTheme } from "../theme-context";

export function Header() {
  const theme = useTheme();

  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={theme.accent}>
        Fiberplane MCP Gateway v{packageJson.version}
      </text>
      <text fg={theme.foregroundMuted}>Gateway: http://localhost:3333</text>
      <text fg={theme.foregroundMuted}>
        MCP: http://localhost:3333/gateway/mcp
      </text>
      <text>{"\n"}</text>
    </box>
  );
}

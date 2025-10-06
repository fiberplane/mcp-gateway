import packageJson from "../../../package.json" with { type: "json" };
import { COLORS } from "../colors";

export function Header() {
  return (
    <box style={{ flexDirection: "column" }}>
      <text fg={COLORS.CYAN}>
        Fiberplane MCP Gateway v{packageJson.version}
      </text>
      <text fg={COLORS.GRAY}>Gateway: http://localhost:3333</text>
      <text fg={COLORS.GRAY}>MCP: http://localhost:3333/gateway/mcp</text>
      <text>{"\n"}</text>
    </box>
  );
}

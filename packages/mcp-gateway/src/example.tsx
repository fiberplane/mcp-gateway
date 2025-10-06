// import { cyan, dim, t, yellow } from "@opentui/core";
import { render } from "@opentui/react";
import packageJson from "../package.json" with { type: "json" };
import { yellow } from "@opentui/core";

const YELLOW = "#FFFF00";
const DIM = "#808080";
function App() {
  return (
    <box style={{ flexDirection: "column", height: "100%", padding: 2 }}>
      {/* Header - content-sized */}
      <box style={{ flexDirection: "column" }}>
        <text fg="#00FFFF">Fiberplane MCP Gateway v{packageJson.version}</text>
        <text fg="#808080">Gateway: http://localhost:3333</text>
        <text fg="#808080">MCP: http://localhost:3333/gateway/mcp</text>
        <text>{"\n"}</text>
      </box>

      {/* Main content - grows to fill space */}
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <text fg="#808080">No servers registered</text>
      </box>

      {/* Footer - content-sized */}
      <box style={{ flexDirection: "column" }}>
        <Shortcut key="a" label="Add server" enabled={true} />
      </box>
    </box>
  );
}

function Shortcut({
  key,
  label,
  enabled,
}: {
  key: string;
  label: string;
  enabled: boolean;
}) {
  return (
    <box style={{ flexDirection: "row" }}>
      <span fg={enabled ? YELLOW : DIM}>[{key}]</span>
      <span fg={enabled ? YELLOW : DIM}>{label}</span>
    </box>
  );
}

render(<App />);

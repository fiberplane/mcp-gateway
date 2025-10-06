import { COLORS } from "../colors";

export function Footer() {
  return (
    <box style={{ flexDirection: "column" }}>
      <box style={{ flexDirection: "row" }}>
        <text fg={COLORS.YELLOW}>[a]</text>
        <text> Add server</text>
      </box>
      <text fg={COLORS.GRAY}>[d] Delete server</text>
      <text fg={COLORS.GRAY}>[c] Clear activity</text>
      <box style={{ flexDirection: "row" }}>
        <text fg={COLORS.YELLOW}>[m]</text>
        <text> MCP instructions</text>
      </box>
      <box style={{ flexDirection: "row" }}>
        <text fg={COLORS.YELLOW}>[q]</text>
        <text> Quit</text>
      </box>
    </box>
  );
}

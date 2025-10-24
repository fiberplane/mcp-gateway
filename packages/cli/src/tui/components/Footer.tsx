import { formatShortcut, globalShortcuts } from "../shortcuts";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";

export function Footer() {
  const theme = useTheme();
  const logs = useAppStore((state) => state.logs);
  const viewMode = useAppStore((state) => state.viewMode);

  const keyColor = theme.foreground;
  const labelColor = theme.foreground;

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
      {/* Left: View context */}
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={labelColor}>
          {viewMode === "activity-log"
            ? `Activity Log • ${logs.length} entries`
            : viewMode === "optimization"
              ? "Optimization"
              : "Server Management"}
        </text>
      </box>

      {/* Right: Essential shortcuts */}
      <box style={{ flexDirection: "row", gap: 1 }}>
        <text fg={keyColor}>
          {formatShortcut(globalShortcuts.commandMenu.key)}
        </text>
        <text fg={labelColor}>Commands</text>
        {viewMode !== "activity-log" && (
          <>
            <text fg={keyColor}>
              {" "}
              • {formatShortcut(globalShortcuts.escape.key)}
            </text>
            <text fg={labelColor}>Back</text>
          </>
        )}
        <text fg={keyColor}> • {formatShortcut(globalShortcuts.quit.key)}</text>
        <text fg={labelColor}>Quit</text>
      </box>
    </box>
  );
}

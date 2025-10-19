import { useTheme } from "../theme-context";

interface ActivityLogHeaderProps {
  totalLogs: number;
  selectedIndex: number;
  itemsAbove: number;
}

export function ActivityLogHeader({
  totalLogs,
  selectedIndex,
  itemsAbove,
}: ActivityLogHeaderProps) {
  const theme = useTheme();

  return (
    <box
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        paddingLeft: 1,
        paddingRight: 1,
        flexGrow: 0,
        border: ["bottom"],
        borderColor: theme.border,
      }}
    >
      {/* Left: Title */}
      <text fg={theme.accent}>Recent Activity</text>

      {/* Center: Overflow indicators */}
      <box
        style={{
          flexDirection: "row",
          gap: 1,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        {itemsAbove > 0 && (
          <text fg={theme.foregroundMuted}>[↑ {itemsAbove} more]</text>
        )}
      </box>

      {/* Right: Position counter */}
      <text fg={theme.foregroundMuted}>
        [{selectedIndex + 1}/{totalLogs}]
      </text>
    </box>
  );
}

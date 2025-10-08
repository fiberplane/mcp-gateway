import type { LogEntry } from "../../tui/state";
import { useTheme } from "../theme-context";
import { formatLogEntry } from "./formatters";

interface ActivityLogEntryProps {
  log: LogEntry;
  isSelected: boolean;
}

export function ActivityLogEntry({ log, isSelected }: ActivityLogEntryProps) {
  const theme = useTheme();

  // Get color for status code
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return theme.success;
    if (status >= 400 && status < 500) return theme.warning;
    return theme.danger;
  };

  const color =
    log.direction === "response"
      ? getStatusColor(log.httpStatus)
      : theme.foregroundMuted;

  return (
    <box
      style={{
        backgroundColor: isSelected ? theme.emphasis : undefined,
      }}
    >
      <text fg={isSelected ? theme.accent : color}>
        {isSelected ? "> " : "  "}
        {formatLogEntry(log)}
      </text>
    </box>
  );
}

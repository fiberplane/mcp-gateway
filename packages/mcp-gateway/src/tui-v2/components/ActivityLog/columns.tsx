import { useMemo } from "react";
import type { LogEntry } from "../../../types";
import type { Theme } from "../../colors";
import { formatRequestDetails, formatResponseDetails } from "../formatters";
import type { Column } from "../ui/Table";
import { formatStatus, getStatusColor, textColumn } from "./helpers.tsx";

/**
 * Create column definitions for the activity log table
 * Memoized to prevent recreating column functions on every render
 */
export function createActivityLogColumns(theme: Theme): Column<LogEntry>[] {
  // Helper to get background color for selected cells
  const cellBackground = (isSelected: boolean) =>
    isSelected ? theme.emphasis : undefined;

  return [
    textColumn({
      id: "time",
      label: "Time",
      width: 9,
      format: (log) => log.timestamp.slice(11, 19), // HH:MM:SS
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "direction",
      label: "Dir",
      width: 4,
      format: (log) => (log.direction === "request" ? "→" : "←"),
      color: (log, isSelected) =>
        isSelected
          ? theme.accent
          : log.direction === "request"
            ? theme.foregroundMuted
            : getStatusColor(log.httpStatus, theme),
      backgroundColor: cellBackground,
      align: "center",
    }),
    textColumn({
      id: "session",
      label: "Session",
      width: 12,
      format: (log) => `[${log.sessionId.slice(0, 8)}]`,
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "requestId",
      label: "Req ID",
      align: "flex-end",
      width: 10,
      truncate: true,
      format: (log) => {
        const id = log.request?.id ?? log.response?.id;
        return id ? String(id).slice(0, 6) : "-";
      },
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "server",
      label: "Server",
      width: 14,
      format: (log) => log.serverName,
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "method",
      label: "Method",
      width: 20,
      truncate: true,
      format: (log) => log.method,
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "status",
      label: "Status",
      width: 8,
      format: (log) =>
        log.direction === "response" ? formatStatus(log.httpStatus) : "-",
      color: (log, isSelected) =>
        isSelected
          ? theme.accent
          : log.direction === "response"
            ? getStatusColor(log.httpStatus, theme)
            : undefined,
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "duration",
      label: "ms",
      width: 6,
      align: "flex-end",
      format: (log) => (log.direction === "response" ? `${log.duration}` : "-"),
      backgroundColor: cellBackground,
    }),
    textColumn({
      id: "details",
      label: "Details",
      width: undefined, // Flexible - will be calculated based on terminal width
      format: (log) => {
        if (log.direction === "request") {
          return formatRequestDetails(log);
        }
        return formatResponseDetails(log);
      },
      backgroundColor: cellBackground,
      last: true,
    }),
  ];
}

/**
 * Hook to memoize activity log columns
 * Only recreates when theme actually changes
 */
export function useActivityLogColumns(theme: Theme) {
  return useMemo(() => createActivityLogColumns(theme), [theme]);
}

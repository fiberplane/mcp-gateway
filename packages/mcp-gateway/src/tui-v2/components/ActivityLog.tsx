import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry } from "../../tui/state";
import type { Color, Theme } from "../colors";
import { useHandler } from "../hooks/useHandler";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { ActivityLogHeader } from "./ActivityLogHeader";
import { formatRequestDetails, formatResponseDetails } from "./formatters";
import { type Column, ColumnBasedTable, truncateText } from "./ui/Table";

type BoxRef = { height: number; onSizeChange?: () => void };

// Constants for terminal sizing
const TERMINAL_PADDING = 2;
const MIN_FLEXIBLE_WIDTH = 20;
const TERMINAL_MARGIN = 4;
const SELECTION_INDICATOR_WIDTH = 2;

// Helper to create a simple text column with format function
function textColumn<T>(config: {
  id: string;
  label?: string;
  width?: number;
  align?: "flex-start" | "flex-end" | "center";
  format: (item: T) => string;
  color?: (item: T, isSelected: boolean) => Color | undefined;
  backgroundColor?: (isSelected: boolean) => Color | undefined;
  truncate?: boolean;
  last?: boolean;
}): Column<T> {
  return {
    id: config.id,
    label: config.label,
    style: {
      width: config.width,
      align: config.align,
      truncate: config.truncate,
    },
    cell: (item, isSelected) => {
      const text = config.format(item).trim();
      const shouldTruncate = config.truncate !== false;
      const truncated = shouldTruncate
        ? truncateText(text, config.width)
        : text;
      const color = config.color?.(item, isSelected);
      const bg = config.backgroundColor?.(isSelected) ?? undefined;

      return (
        <box backgroundColor={bg} paddingRight={config.last ? 0 : 1}>
          <text
            fg={color}
            style={{
              alignSelf: config.align || "flex-start",
              maxHeight: 1,
            }}
          >
            {truncated}
          </text>
        </box>
      );
    },
  };
}

// Helper to format HTTP status
function formatStatus(status: number): string {
  if (status === 200) return "200 OK";
  if (status === 404) return "404";
  if (status >= 500) return `${status}`;
  if (status >= 400) return `${status}`;
  return `${status}`;
}

// Helper to get status color
function getStatusColor(status: number, theme: Theme): Color {
  if (status >= 200 && status < 300) return theme.success;
  if (status >= 400 && status < 500) return theme.warning;
  return theme.danger;
}

// Calculate width for flexible columns based on terminal width
function calculateFlexibleColumnWidth(
  columns: Column<LogEntry>[],
  terminalWidth: number,
): number {
  // Calculate total width of fixed columns
  const fixedWidthTotal = columns
    .filter((col) => col.style?.width !== undefined)
    .reduce((sum, col) => sum + (col.style?.width ?? 0), 0);

  // Available space for flexible columns
  const availableSpace =
    terminalWidth - fixedWidthTotal - SELECTION_INDICATOR_WIDTH;

  // Count flexible columns
  const flexibleCount = columns.filter(
    (col) => col.style?.width === undefined,
  ).length;

  // Calculate width per flexible column (minimum 10 chars)
  return Math.max(10, Math.floor(availableSpace / flexibleCount));
}

// Column configuration for the activity log table (stable, defined outside component)
function createActivityLogColumns(theme: Theme): Column<LogEntry>[] {
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
      width: 12,
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

export function ActivityLog() {
  const theme = useTheme();
  const logs = useAppStore((state) => state.logs);
  const { width: terminalWidth } = useTerminalDimensions();

  // Get columns with theme
  const activityLogColumns = useMemo(
    () => createActivityLogColumns(theme),
    [theme],
  );

  // Calculate flexible column widths based on terminal width
  const columnsWithCalculatedWidths = useMemo(() => {
    const flexibleWidth = calculateFlexibleColumnWidth(
      activityLogColumns,
      terminalWidth - TERMINAL_PADDING,
    );

    if (flexibleWidth <= MIN_FLEXIBLE_WIDTH) {
      const result: Column<LogEntry>[] = [];
      let totalWidth = 0;

      for (const col of activityLogColumns) {
        if (!col.style?.width) continue;

        totalWidth += col.style.width;
        if (totalWidth >= terminalWidth - TERMINAL_MARGIN) break;

        result.push(col);
      }
      return result;
    }

    return activityLogColumns.map((col) => {
      if (col.style?.width === undefined) {
        return {
          ...col,
          style: { ...col.style, width: flexibleWidth },
        };
      }
      return col;
    });
  }, [activityLogColumns, terminalWidth]);

  // Container ref to get actual rendered height
  const containerRef = useRef<BoxRef | null>(null);
  const containerHeightRef = useRef(10);

  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Line-based scroll position - which line (pixel) is at the top of viewport
  const [scrollPosition, setScrollPosition] = useState(0);
  // Follow mode state - explicit opt-in
  const [isFollowMode, setIsFollowMode] = useState(true);

  // Defensive: ensure selectedIndex is always valid
  const safeSelectedIndex = Math.max(
    0,
    Math.min(selectedIndex, Math.max(0, logs.length - 1)),
  );

  // Height tracking: for now all items are 1 line, but this supports variable heights
  const itemHeights = logs.map(() => 1); // TODO: track actual rendered heights

  // Calculate cumulative positions (where each item starts in line-space)
  const itemPositions = itemHeights.reduce<number[]>(
    (positions, _height, i) => {
      positions.push(
        i === 0 ? 0 : (positions[i - 1] ?? 0) + (itemHeights[i - 1] ?? 1),
      );
      return positions;
    },
    [],
  );

  // Viewport info
  const viewportHeight = Math.max(1, containerHeightRef.current);
  const viewportStart = scrollPosition;
  const viewportEnd = scrollPosition + viewportHeight;

  // Helper: is an item visible in current viewport?
  const isItemVisible = (index: number): boolean => {
    if (index < 0 || index >= logs.length) return false;
    const itemStart = itemPositions[index] ?? 0;
    const itemEnd = itemStart + (itemHeights[index] ?? 1);
    return itemEnd > viewportStart && itemStart < viewportEnd;
  };

  // Calculate overflow indicators
  const itemsAbove = logs.filter((_, i) => {
    const itemEnd = (itemPositions[i] ?? 0) + (itemHeights[i] ?? 1);
    return itemEnd <= viewportStart;
  }).length;

  const itemsBelow = logs.filter((_, i) => {
    const itemStart = itemPositions[i] ?? 0;
    return itemStart >= viewportEnd;
  }).length;

  // Auto-scroll to keep selection visible
  useEffect(() => {
    if (logs.length === 0 || itemPositions.length === 0) return;

    const selectedItemStart = itemPositions[safeSelectedIndex] ?? 0;
    const selectedItemEnd =
      selectedItemStart + (itemHeights[safeSelectedIndex] ?? 1);

    setScrollPosition((currentScroll) => {
      const viewportStart = currentScroll;
      const viewportEnd = currentScroll + viewportHeight;

      // If selected item starts above viewport, scroll up to show it at top
      if (selectedItemStart < viewportStart) {
        return Math.max(0, selectedItemStart);
      }

      // If selected item ends below viewport, scroll down to show it at bottom
      if (selectedItemEnd > viewportEnd) {
        return Math.max(0, selectedItemEnd - viewportHeight);
      }

      // Item is fully visible, don't scroll
      return currentScroll;
    });
  }, [safeSelectedIndex, itemPositions, itemHeights, viewportHeight]);

  // Auto-follow when in follow mode and new logs arrive
  useEffect(() => {
    if (logs.length === 0) {
      setSelectedIndex(0);
      setScrollPosition(0);
      return;
    }

    if (selectedIndex >= logs.length) {
      setSelectedIndex(logs.length - 1);
    }

    // When in follow mode, always move selection to the last item
    if (isFollowMode) {
      setSelectedIndex(logs.length - 1);
    }
  }, [logs.length, isFollowMode, selectedIndex]);

  const openModal = useAppStore((state) => state.openModal);
  const setSelectedLog = useAppStore((state) => state.setSelectedLog);
  const activeModal = useAppStore((state) => state.activeModal);

  // Keyboard navigation
  useKeyboard((key) => {
    // Don't process keys if a modal is open
    if (activeModal) return;
    if (logs.length === 0) return;

    if (key.name === "return" || key.name === "enter") {
      // Open detail modal for selected log
      const selectedLog = logs[safeSelectedIndex];
      if (selectedLog) {
        setSelectedLog(selectedLog);
        openModal("activity-log-detail");
      }
      return;
    }
    if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      // Exit follow mode when scrolling up
      if (isFollowMode) {
        setIsFollowMode(false);
      }
    }
    if (key.name === "down") {
      setSelectedIndex((prev) => {
        const next = Math.min(logs.length - 1, prev + 1);
        // If we're at the last item and press down again, enter follow mode
        if (prev === logs.length - 1 && next === logs.length - 1) {
          setIsFollowMode(true);
        }
        return next;
      });
    }
    if (key.name === "left") {
      // Page up
      setSelectedIndex((prev) => Math.max(0, prev - 10));
      // Exit follow mode when scrolling up
      if (isFollowMode) {
        setIsFollowMode(false);
      }
    }
    if (key.name === "right") {
      // Page down
      setSelectedIndex((prev) => Math.min(logs.length - 1, prev + 10));
    }
    if (key.name === "home") {
      setSelectedIndex(0);
      // Exit follow mode when jumping to top
      if (isFollowMode) {
        setIsFollowMode(false);
      }
    }
    if (key.name === "end") {
      setSelectedIndex(logs.length - 1);
      // Enter follow mode when pressing End
      setIsFollowMode(true);
    }
  });

  const updateHeight = useHandler((ref: BoxRef) => {
    const newHeight = ref.height;
    if (newHeight > 0 && newHeight !== containerHeightRef.current) {
      containerHeightRef.current = newHeight;
    }
  });

  return (
    <box
      style={{
        flexDirection: "column",
        flexGrow: 1,
        maxHeight: "100%",
        border: false,
        // borderColor: theme.border,
      }}
    >
      {/* Header with status and overflow indicators */}
      <ActivityLogHeader
        totalLogs={logs.length}
        selectedIndex={safeSelectedIndex}
        itemsAbove={itemsAbove}
      />

      {/* Main content area */}
      <box
        ref={(ref) => {
          if (ref) {
            containerRef.current = ref;
            updateHeight(ref);
            // Listen for size changes (terminal resize)
            ref.onSizeChange = () => {
              updateHeight(ref);
            };
          }
        }}
        style={{
          flexGrow: 1,
          flexBasis: 1,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          width: "100%",
        }}
      >
        {/* Column-based table */}
        <ColumnBasedTable
          key={terminalWidth}
          columns={columnsWithCalculatedWidths}
          data={logs}
          selectedIndex={safeSelectedIndex}
          isItemVisible={isItemVisible}
          getItemKey={(log) =>
            `${log.sessionId}-${log.timestamp}-${log.direction}`
          }
          headerForegroundColor={theme.foregroundMuted}
          renderSelectionIndicator={(isSelected) => (
            <box backgroundColor={isSelected ? theme.emphasis : undefined}>
              <text fg={isSelected ? theme.accent : theme.foreground}>
                {isSelected ? "> " : "  "}
              </text>
            </box>
          )}
        />
      </box>

      {/* Bottom overflow/follow indicator */}
      {isFollowMode ? (
        <box
          style={{
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <text fg={theme.accent}>
            [Following new items - Press ↑ to pause]
          </text>
        </box>
      ) : itemsBelow > 0 ? (
        <box
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            alignItems: "center",
          }}
        >
          <text fg={theme.foregroundMuted}>
            [↓ {itemsBelow} more {itemsBelow === 1 ? "item" : "items"} - Press
            End to follow]
          </text>
        </box>
      ) : (
        <box style={{ height: 1 }} />
      )}
    </box>
  );
}

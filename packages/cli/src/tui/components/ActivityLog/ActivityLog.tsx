import type { LogEntry } from "@fiberplane/mcp-gateway-types";
import { useTerminalDimensions } from "@opentui/react";
import { useMemo, useRef } from "react";
import { useHandler } from "../../hooks/useHandler";
import { useAppStore } from "../../store";
import { useTheme } from "../../theme-context";
import { ActivityLogHeader } from "../ActivityLogHeader";
import { type Column, ColumnBasedTable } from "../ui/Table";
import { useActivityLogColumns } from "./columns";
import {
  calculateFlexibleColumnWidth,
  MIN_FLEXIBLE_WIDTH,
  TERMINAL_MARGIN,
  TERMINAL_PADDING,
} from "./helpers.tsx";
import { useActivityLogKeys } from "./useActivityLogKeys";
import { useActivityLogScroll } from "./useActivityLogScroll";

type BoxRef = { height: number; onSizeChange?: () => void };

export function ActivityLog() {
  const theme = useTheme();
  const logs = useAppStore((state) => state.logs);
  const { width: terminalWidth } = useTerminalDimensions();

  // Container ref to get actual rendered height
  const containerRef = useRef<BoxRef | null>(null);
  const containerHeightRef = useRef(10);

  // Get memoized columns with theme
  const activityLogColumns = useActivityLogColumns(theme);

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

    // Only create new column objects if width actually needs updating
    return activityLogColumns.map((col) => {
      if (col.style?.width === undefined) {
        // Check if we already have the correct width to avoid recreating object
        if (col.style?.width === flexibleWidth) {
          return col;
        }
        return {
          ...col,
          style: { ...col.style, width: flexibleWidth },
        };
      }
      return col;
    });
  }, [activityLogColumns, terminalWidth]);

  // Scroll and viewport management
  const scroll = useActivityLogScroll(logs, containerHeightRef.current);

  // Keyboard navigation
  useActivityLogKeys(scroll, logs);

  // Handle container height updates
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
      }}
    >
      {/* Header with status and overflow indicators */}
      <ActivityLogHeader
        totalLogs={logs.length}
        selectedIndex={scroll.selectedIndex}
        itemsAbove={scroll.itemsAbove}
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
          selectedIndex={scroll.selectedIndex}
          isItemVisible={scroll.isItemVisible}
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
      {scroll.isFollowMode ? (
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
      ) : scroll.itemsBelow > 0 ? (
        <box
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            alignItems: "center",
          }}
        >
          <text fg={theme.foregroundMuted}>
            [↓ {scroll.itemsBelow} more{" "}
            {scroll.itemsBelow === 1 ? "item" : "items"} - Press End to follow]
          </text>
        </box>
      ) : (
        <box style={{ height: 1 }} />
      )}
    </box>
  );
}

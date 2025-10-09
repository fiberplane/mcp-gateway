import type { RGBA } from "@opentui/core";
import type React from "react";

export interface ColumnStyle {
  width?: number; // Fixed width in characters (undefined = flexible)
  align?: "flex-start" | "flex-end" | "center"; // Text alignment (default: flex-start)
  truncate?: boolean; // Truncate with ... if too long (default: true)
  fg?: string; // Text color (can be overridden by cell function)
}

export interface Column<T> {
  // Unique identifier for the column
  id: string;

  // Column header - can be string or function returning JSX
  label?: string | (() => React.ReactNode);

  // Column style
  style?: ColumnStyle;

  // Cell render function - returns JSX element for the cell
  // Receives: item, isSelected
  cell: (item: T, isSelected: boolean) => React.ReactNode;
}

/**
 * Truncate text to fit within width, adding ... if needed
 */
export function truncateText(text: string, width?: number): string {
  if (!width || width === 0) return text; // Flexible column, don't truncate
  if (text.length <= width) return text;
  if (width < 3) return text.slice(0, width);
  return `${text.slice(0, width - 3)}…`;
}

export interface ColumnBasedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  selectedIndex?: number;
  renderSelectionIndicator?: (isSelected: boolean) => React.ReactNode;
  isItemVisible?: (index: number) => boolean; // Optional virtualization
  getItemKey: (item: T, index: number) => string;
  headerForegroundColor?: string | RGBA; // For header text color
}

export function ColumnBasedTable<T>(
  props: ColumnBasedTableProps<T>,
): React.ReactNode {
  const {
    columns,
    data,
    selectedIndex,
    renderSelectionIndicator,
    isItemVisible,
    getItemKey,
    headerForegroundColor,
  } = props;

  // If no isItemVisible provided, all items are visible
  const itemVisible = isItemVisible ?? (() => true);

  return (
    <box style={{ flexDirection: "row", gap: 0 }}>
      {/* Selection indicator column */}
      {renderSelectionIndicator && (
        <box style={{ flexDirection: "column", width: 2 }}>
          {/* Header cell */}
          <text fg={headerForegroundColor}>{"  "}</text>

          {/* Data cells */}
          {data.map((item, i) => {
            if (!itemVisible(i)) return null;
            const isSelected = i === selectedIndex;
            return (
              <box key={`sel-${getItemKey(item, i)}`}>
                {renderSelectionIndicator(isSelected)}
              </box>
            );
          })}
        </box>
      )}

      {/* Data columns */}
      {columns.map((col) => (
        <box
          key={col.id}
          style={{ flexDirection: "column", width: col.style?.width || "auto" }}
        >
          {/* Header cell */}
          {typeof col.label === "string" && (
            <text
              fg={headerForegroundColor}
              style={{
                alignSelf: col.style?.align || "flex-start",
                paddingRight: 1,
              }}
            >
              {col.label}
            </text>
          )}
          {typeof col.label === "function" && col.label()}
          {!col.label && <text> </text>}

          {/* Data cells */}
          {data.map((item, i) => {
            if (!itemVisible(i)) return null;
            const isSelected = i === selectedIndex;
            return (
              <box key={`${col.id}-${getItemKey(item, i)}`}>
                {col.cell(item, isSelected)}
              </box>
            );
          })}
        </box>
      ))}
    </box>
  );
}

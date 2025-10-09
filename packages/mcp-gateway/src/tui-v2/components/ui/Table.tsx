import type React from "react";

export interface ColumnStyle {
  width?: number; // Fixed width in characters (undefined = flexible)
  align?: "left" | "right"; // Text alignment (default: left)
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

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  selectedIndex?: number; // Which row is selected (for highlighting)
  showHeader?: boolean; // Show column headers (default: true)
  renderSelectionIndicator?: (isSelected: boolean) => React.ReactNode; // Optional selection indicator renderer
  selectionBackgroundColor?: string; // Background color for selected row
}

/**
 * Truncate text to fit within width, adding ... if needed
 */
export function truncateText(text: string, width?: number): string {
  if (!width || width === 0) return text; // Flexible column, don't truncate
  if (text.length <= width) return text;
  if (width < 3) return text.slice(0, width);
  return `${text.slice(0, width - 1)}…`;
}

/**
 * Pad text to exact width with spaces
 */
export function padText(
  text: string,
  width?: number,
  align: "left" | "right" = "left",
): string {
  if (!width || width === 0) return text; // Flexible column, don't pad
  if (text.length >= width) return text;

  const padding = " ".repeat(width - text.length);
  return align === "right" ? padding + text : text + padding;
}

export function Table<T>({
  columns,
  data,
  selectedIndex,
  showHeader = true,
  renderSelectionIndicator,
  selectionBackgroundColor,
}: TableProps<T>): React.ReactNode {
  return (
    <box style={{ flexDirection: "column" }}>
      {/* Header row */}
      {showHeader && (
        <box style={{ flexDirection: "row", gap: 1 }}>
          {/* Selection indicator space */}
          {renderSelectionIndicator && (
            <box style={{ width: 2 }}>{renderSelectionIndicator(false)}</box>
          )}

          {/* Column headers */}
          {columns.map((col) => {
            // Render label as function or string
            if (typeof col.label === "function") {
              return <box key={col.id}>{col.label()}</box>;
            }

            if (typeof col.label === "string") {
              const width = col.style?.width;
              const align = col.style?.align || "left";
              const labelText = col.label;

              return (
                <text
                  key={col.id}
                  style={{
                    width: width || undefined,
                    alignSelf: align === "right" ? "flex-end" : "flex-start",
                  }}
                >
                  {labelText}
                </text>
              );
            }

            // No label
            return (
              <box
                key={col.id}
                style={{ width: col.style?.width || undefined }}
              />
            );
          })}
        </box>
      )}

      {/* Data rows */}
      {data.map((item, rowIndex) => {
        const isSelected = selectedIndex === rowIndex;

        return (
          <box
            // biome-ignore lint/suspicious/noArrayIndexKey: It's okay to use the index as the key here
            key={rowIndex}
            style={{
              flexDirection: "row",
              gap: 0,
              backgroundColor: isSelected
                ? selectionBackgroundColor
                : undefined,
            }}
          >
            {/* Selection indicator column */}
            {renderSelectionIndicator && (
              <box style={{ width: 2 }}>
                {renderSelectionIndicator(isSelected)}
              </box>
            )}

            {/* Data columns */}
            {columns.map((col) => (
              <box
                key={col.id}
                style={{ width: col.style?.width || undefined, backgroundColor: selectionBackgroundColor }}
              >
                {col.cell(item, isSelected)}
              </box>
            ))}
          </box>
        );
      })}
    </box>
  );
}

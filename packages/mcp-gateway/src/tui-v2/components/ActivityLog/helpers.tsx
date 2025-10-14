import type { LogEntry } from "@fiberplane/mcp-gateway-types";
import type { Color, Theme } from "../../colors";
import { type Column, truncateText } from "../ui/Table";

// Constants for terminal sizing
export const TERMINAL_PADDING = 2;
export const MIN_FLEXIBLE_WIDTH = 20;
export const TERMINAL_MARGIN = 4;
export const SELECTION_INDICATOR_WIDTH = 2;

/**
 * Helper to create a simple text column with format function
 */
export function textColumn<T>(config: {
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

/**
 * Format HTTP status code for display
 */
export function formatStatus(status: number): string {
  if (status === 200) return "200 OK";
  if (status === 404) return "404";
  if (status >= 500) return `${status}`;
  if (status >= 400) return `${status}`;
  return `${status}`;
}

/**
 * Get color for HTTP status code
 */
export function getStatusColor(status: number, theme: Theme): Color {
  if (status >= 200 && status < 300) return theme.success;
  if (status >= 400 && status < 500) return theme.warning;
  return theme.danger;
}

/**
 * Calculate width for flexible columns based on terminal width
 */
export function calculateFlexibleColumnWidth(
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

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

/**
 * Optimized table component with row-first rendering
 * Only renders visible rows, then renders cells within each row
 */
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
		<box style={{ flexDirection: "column", gap: 0 }}>
			{/* Header row */}
			<box style={{ flexDirection: "row", gap: 0 }}>
				{/* Selection indicator header */}
				{renderSelectionIndicator && (
					<box style={{ width: 2 }}>
						<text fg={headerForegroundColor}>{"  "}</text>
					</box>
				)}

				{/* Column headers */}
				{columns.map((col) => (
					<box
						key={`header-${col.id}`}
						style={{ width: col.style?.width || "auto" }}
					>
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
					</box>
				))}
			</box>

			{/* Data rows - only render visible items */}
			{data.map((item, i) => {
				// Skip invisible items early - only check once per row
				if (!itemVisible(i)) return null;

				const isSelected = i === selectedIndex;
				const rowKey = getItemKey(item, i);

				return (
					<box key={rowKey} style={{ flexDirection: "row", gap: 0 }}>
						{/* Selection indicator */}
						{renderSelectionIndicator && (
							<box style={{ width: 2 }}>{renderSelectionIndicator(isSelected)}</box>
						)}

						{/* Data cells */}
						{columns.map((col) => (
							<box
								key={`${col.id}-${rowKey}`}
								style={{ width: col.style?.width || "auto" }}
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

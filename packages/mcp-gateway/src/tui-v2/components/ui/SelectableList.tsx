import { useTheme } from "../../theme-context";

interface SelectableListProps<T> {
	items: T[];
	selectedIndex: number;
	renderItem: (item: T, isSelected: boolean) => React.ReactNode;
	getItemKey: (item: T, index: number) => string;
}

/**
 * Generic selectable list component with keyboard navigation
 */
export function SelectableList<T>({
	items,
	selectedIndex,
	renderItem,
	getItemKey,
}: SelectableListProps<T>) {
	const theme = useTheme();

	return (
		<box style={{ flexDirection: "column" }}>
			{items.map((item, index) => {
				const isSelected = index === selectedIndex;
				return (
					<box
						key={getItemKey(item, index)}
						style={{
							padding: 1,
							backgroundColor: isSelected ? theme.emphasis : undefined,
						}}
					>
						{renderItem(item, isSelected)}
					</box>
				);
			})}
		</box>
	);
}

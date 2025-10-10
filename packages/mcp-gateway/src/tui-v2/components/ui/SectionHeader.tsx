import type { BoxProps } from "@opentui/react";
import { useTheme } from "../../theme-context";

interface SectionHeaderProps {
	title: string;
	subtitle?: string;
	borderSides?: BoxProps["style"]["border"];
	style?: BoxProps["style"];
}

/**
 * Reusable section header component with title, optional subtitle, and border
 */
export function SectionHeader({
	title,
	subtitle,
	borderSides = ["bottom"],
	style,
}: SectionHeaderProps) {
	const theme = useTheme();

	return (
		<box
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "flex-start",
				border: borderSides,
				borderColor: theme.border,
				...style,
			}}
		>
			<text fg={theme.accent}>{title}</text>
			{subtitle && <text fg={theme.foregroundMuted}>{subtitle}</text>}
		</box>
	);
}

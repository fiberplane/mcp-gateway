import { useTheme } from "../../theme-context";

type BorderSides = boolean | ("top" | "bottom" | "left" | "right")[];

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  borderSides?: BorderSides;
  style?: object;
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

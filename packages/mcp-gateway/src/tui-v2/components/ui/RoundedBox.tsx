import type { BoxProps } from "@opentui/react";
import { useCompactHeight } from "../../hooks/useCompactHeight";
import { useTheme } from "../../theme-context";

export function RoundedBox({
  children,
  style,
  title,
}: {
  children: React.ReactNode;
} & Pick<BoxProps, "style" | "title">) {
  const theme = useTheme();
  const compactHeight = useCompactHeight();

  return (
    <box
      title={title ? ` ${title} ` : undefined}
      style={{
        flexDirection: "column",
        gap: 1,
        border: true,
        borderColor: theme.border,
        padding: 1,
        paddingTop: compactHeight.enabled ? 0 : 1,
        paddingBottom: compactHeight.enabled ? 0 : 1,
        borderStyle: "rounded",
        maxWidth: 66,
        ...style,
      }}
    >
      {children}
    </box>
  );
}

import type { BoxProps } from "@opentui/react";
import { useIsSmall } from "../../hooks/useIsSmall";
import { useTheme } from "../../theme-context";

export function RoundedBox({
  children,
  style,
  title,
}: {
  children: React.ReactNode;
} & Pick<BoxProps, "style" | "title">) {
  const theme = useTheme();
  const isSmall = useIsSmall();

  return (
    <box
      title={title ? ` ${title} ` : undefined}
      style={{
        flexDirection: "column",
        gap: 1,
        border: true,
        borderColor: theme.border,
        padding: 1,
        paddingTop: isSmall ? 0 : 1,
        paddingBottom: isSmall ? 0 : 1,
        borderStyle: "rounded",
        maxWidth: 66,
        ...style,
      }}
    >
      {children}
    </box>
  );
}

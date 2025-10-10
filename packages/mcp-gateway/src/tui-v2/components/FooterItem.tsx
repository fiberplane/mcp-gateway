import { useTheme } from "../theme-context";

interface FooterItemProps {
  shortcutKey: string;
  label: string;
  disabled?: boolean;
}

export function FooterItem({
  shortcutKey,
  label,
  disabled = false,
}: FooterItemProps) {
  const theme = useTheme();
  const keyColor = disabled ? theme.foregroundMuted : theme.warning;
  const labelColor = disabled ? theme.foregroundMuted : theme.foreground;

  return (
    <box style={{ flexDirection: "row" }}>
      <text fg={keyColor}>[{shortcutKey}]</text>
      <text fg={labelColor}> {label}</text>
    </box>
  );
}

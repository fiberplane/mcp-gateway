import { COLORS } from "../colors";

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
  const keyColor = disabled ? COLORS.GRAY : COLORS.YELLOW;
  const labelColor = disabled ? COLORS.GRAY : COLORS.WHITE;

  return (
    <box style={{ flexDirection: "row" }}>
      <text fg={keyColor}>[{shortcutKey}]</text>
      <text fg={labelColor}> {label}</text>
    </box>
  );
}

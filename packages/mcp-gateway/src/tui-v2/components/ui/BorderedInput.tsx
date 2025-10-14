import { useTheme } from "../../theme-context";

interface BorderedInputProps {
  title: string;
  placeholder?: string;
  value: string;
  onInput?: (value: string) => void;
  onPaste?: (value: string) => void;
  onSubmit?: () => void;
  focused?: boolean;
  width?: number;
  height?: number;
}

/**
 * Input component with a bordered box and title
 */
export function BorderedInput({
  title,
  placeholder,
  value,
  onInput,
  onPaste,
  onSubmit,
  focused = false,
  width = 50,
  height = 3,
}: BorderedInputProps) {
  const theme = useTheme();

  return (
    <box
      title={title}
      style={{
        border: true,
        borderColor: theme.foregroundMuted,
        width,
        height,
        paddingLeft: 1,
        paddingRight: 1,
        flexShrink: 0,
      }}
    >
      <input
        placeholder={placeholder}
        value={value}
        onInput={onInput}
        onPaste={onPaste}
        onSubmit={onSubmit}
        focused={focused}
        style={{
          paddingLeft: 1,
          paddingRight: 1,
        }}
      />
    </box>
  );
}

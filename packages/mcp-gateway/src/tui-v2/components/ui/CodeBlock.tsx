import { useTheme } from "../../theme-context";

interface CodeBlockProps {
  content: string | string[];
  padding?: number;
  style?: object;
}

/**
 * Component for displaying code blocks with consistent styling
 */
export function CodeBlock({ content, padding = 1, style }: CodeBlockProps) {
  const theme = useTheme();

  const lines = Array.isArray(content) ? content : content.split("\n");

  return (
    <box
      style={{
        flexDirection: "column",
        maxWidth: 66,
        padding,
        flexShrink: 0,
        ...style,
      }}
      backgroundColor={theme.emphasis}
    >
      {lines.map((line, i) => (
        <text
          // biome-ignore lint/suspicious/noArrayIndexKey: Array is static during render
          key={i}
          fg={theme.foreground}
        >
          {line || " "}
        </text>
      ))}
    </box>
  );
}

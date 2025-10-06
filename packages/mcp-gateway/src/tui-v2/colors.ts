// Raw color palette
const palette = {
  cyan: "#00FFFF",
  yellow: "#FFFF00",
  green: "#00FF00",
  red: "#FF0000",
  gray: "#808080",
  white: "#FFFFFF",
  black: "#000000",
} as const;

// Theme type definition
export interface Theme {
  // Core colors
  foreground: string;
  foregroundMuted: string;
  background: string;
  accent: string;
  accentActive: string;

  // Status colors
  success: string;
  warning: string;
  danger: string;
  info: string;

  // UI elements
  border: string;
  borderFocus: string;
  disabled: string;

  // Syntax highlighting
  syntaxKey: string;
  syntaxString: string;
  syntaxPunctuation: string;
}

// Default theme with semantic color names
export const defaultTheme: Theme = {
  // Core
  foreground: palette.white,
  foregroundMuted: palette.gray,
  background: palette.black,
  accent: palette.cyan,
  accentActive: palette.yellow,

  // Status
  success: palette.green,
  warning: palette.yellow,
  danger: palette.red,
  info: palette.cyan,

  // UI
  border: palette.cyan,
  borderFocus: palette.cyan,
  disabled: palette.gray,

  // Syntax
  syntaxKey: palette.yellow,
  syntaxString: palette.green,
  syntaxPunctuation: palette.gray,
};

// Backward compatibility - keep COLORS export for gradual migration
export const COLORS = {
  CYAN: palette.cyan,
  YELLOW: palette.yellow,
  GREEN: palette.green,
  RED: palette.red,
  GRAY: palette.gray,
  WHITE: palette.white,
  BLACK: palette.black,
} as const;

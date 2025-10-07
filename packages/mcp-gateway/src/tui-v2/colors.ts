// Raw color palette from web UI design system
const palette = {
  // Brand (Flame)
  flame: "#FF5C33",
  flameDark: "#E65C1F",

  // Functional colors
  info: "#4BA8D4",
  success: "#6CAD35",
  danger: "#E85D75",
  warning: "#E8A64A",

  // Accent colors
  mint: "#52C9A3",
  purple: "#B77CDD",
  pink: "#DD7CB7",

  // Neutrals (warm grays)
  white: "#F7F5F2", // neutral-50
  gray200: "#CCC9C3", // neutral-300
  gray500: "#797876", // neutral-500
  gray700: "#3A3937", // neutral-700
  gray800: "#272623", // neutral-800
  gray900: "#1C1B18", // neutral-900
  black: "#0F0E0C", // neutral-950
} as const;

// Theme type definition
export interface Theme {
  // Core colors
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  background: string;

  // Brand colors
  brand: string;
  brandForeground: string;

  // Accent colors
  accent: string;
  accentForeground: string;
  accentActive: string;

  // Status colors
  success: string;
  warning: string;
  danger: string;
  info: string;

  // UI elements
  border: string;
  borderFocus: string;
  emphasis: string;

  // Syntax highlighting
  syntaxKey: string;
  syntaxString: string;
  syntaxPunctuation: string;
}

// Default theme with semantic color names
export const defaultTheme: Theme = {
  // Core
  foreground: palette.white,
  foregroundMuted: palette.gray200,
  foregroundSubtle: palette.gray500,
  background: palette.gray900,

  // Brand
  brand: palette.flame,
  brandForeground: palette.black,

  // Accent
  accent: palette.info,
  accentForeground: palette.black,
  accentActive: palette.warning,

  // Status
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
  info: palette.info,

  // UI
  border: palette.gray700,
  borderFocus: palette.info,
  emphasis: palette.gray800,

  // Syntax
  syntaxKey: palette.warning,
  syntaxString: palette.success,
  syntaxPunctuation: palette.gray500,
};

// Backward compatibility - keep COLORS export for gradual migration
export const COLORS = {
  CYAN: palette.info,
  YELLOW: palette.warning,
  GREEN: palette.success,
  RED: palette.danger,
  GRAY: palette.gray500,
  WHITE: palette.white,
  BLACK: palette.black,
} as const;

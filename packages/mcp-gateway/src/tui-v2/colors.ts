import { RGBA } from "@opentui/core";

// Raw color palette from web UI design system
const palette = {
  // Brand (Flame)
  flame: "#ff5833",
  // flameDark: "#E65C1F",

  // Functional colors
  // info: "#4BA8D4",
  // info: "#ffbcad",
  info: "#a6c9dd",
  success500: "#79a136",
  danger500: "#e03e43",
  warning500: "#e1a847",

  // // Accent colors
  // mint: "#52C9A3",
  // purple: "#B77CDD",
  // pink: "#DD7CB7",

  // Neutrals (warm grays)
  white: "#F6F4F4", // neutral-50
  neutral300: "#cdcbc6", // neutral-300
  neutral500: "#7a7975", // neutral-500
  neutral700: "#3a3936", // neutral-700
  neutral800: "#282725", // neutral-800
  neutral900: "#1b1a18", // neutral-900
  neutral950: "#0F0E0C", // neutral-950
  blackTransparent: RGBA.fromInts(28, 27, 24, 128), // neutral-900 at 50% opacity
} as const;

// Theme type definition

type Color = string | RGBA;
export interface Theme {
  // Core colors
  foreground: Color;
  foregroundMuted: Color;
  foregroundSubtle: Color;
  background: Color;
  backgroundTransparent: Color;

  // Brand colors
  brand: Color;
  brandForeground: Color;

  // Accent colors
  accent: Color;
  accentForeground: Color;
  accentActive: Color;

  // Status colors
  success: Color;
  warning: Color;
  danger: Color;
  info: Color;

  // UI elements
  border: Color;
  borderFocus: Color;
  emphasis: Color;

  // Syntax highlighting
  syntaxKey: Color;
  syntaxString: Color;
  syntaxPunctuation: Color;
}

// Default theme with semantic color names
export const defaultTheme: Theme = {
  // Core
  foreground: palette.white,
  foregroundMuted: palette.neutral300,
  foregroundSubtle: palette.neutral500,
  background: palette.neutral900,
  backgroundTransparent: palette.blackTransparent,

  // Brand
  brand: palette.flame,
  brandForeground: palette.neutral950,

  // Accent
  accent: palette.info,
  accentForeground: palette.neutral950,
  accentActive: palette.warning500,

  // Status
  success: palette.success500,
  warning: palette.warning500,
  danger: palette.danger500,
  info: palette.info,

  // UI
  border: palette.neutral700,
  borderFocus: palette.neutral500,
  emphasis: palette.neutral800,

  // Syntax
  syntaxKey: palette.warning500,
  syntaxString: palette.success500,
  syntaxPunctuation: palette.neutral500,
};

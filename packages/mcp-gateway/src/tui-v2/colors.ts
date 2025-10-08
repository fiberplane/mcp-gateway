import { RGBA } from "@opentui/core";

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
  foregroundMuted: palette.gray200,
  foregroundSubtle: palette.gray500,
  background: palette.gray900,
  backgroundTransparent: palette.blackTransparent,

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

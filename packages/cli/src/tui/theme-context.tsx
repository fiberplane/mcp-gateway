import { createContext, useContext } from "react";
import { defaultTheme, type Theme } from "./colors";

// Create theme context with default theme
const ThemeContext = createContext<Theme>(defaultTheme);

interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Theme;
}

/**
 * ThemeProvider component
 * Wraps the app and provides theme to all child components
 */
export function ThemeProvider({
  children,
  theme = defaultTheme,
}: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * useTheme hook
 * Returns the current theme object
 * Usage: const theme = useTheme();
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

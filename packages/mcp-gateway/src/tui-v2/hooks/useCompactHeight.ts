import { useTerminalDimensions } from "@opentui/react";

/**
 * Hook to detect if terminal height is compact (small)
 * Useful for adjusting UI layout in smaller terminal windows
 *
 * @returns Object with enabled flag indicating compact height mode
 */
export function useCompactHeight() {
  const { height } = useTerminalDimensions();
  return { enabled: height < 40 };
}

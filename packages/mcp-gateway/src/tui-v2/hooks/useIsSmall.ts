import { useTerminalDimensions } from "@opentui/react";

export function useIsSmall() {
  const { height } = useTerminalDimensions();
  return height < 40;
}

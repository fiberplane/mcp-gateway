import { useCallback, useRef } from "react";

const noDeps: [] = [];

/**
 * Creates a stable callback reference that always calls the latest handler.
 *
 * This is useful when you need a stable function reference (e.g., for useEffect deps)
 * but want to avoid stale closures. It's similar to React's experimental useEvent.
 *
 * @param handler - The handler function to memoize
 * @returns A memoized handler that always calls the latest version
 */
export function useHandler<TArgs extends readonly unknown[], TReturn>(
  handler: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // biome-ignore lint/correctness/useExhaustiveDependencies: noDeps is intentionally empty constant array
  return useCallback((...args: TArgs) => handlerRef.current(...args), noDeps);
}

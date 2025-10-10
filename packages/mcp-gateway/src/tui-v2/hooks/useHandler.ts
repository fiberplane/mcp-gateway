import { useCallback, useRef } from "react";

const noDeps: Array<void> = [];

type MemoizedHandler<Handler extends (...args: Array<unknown>) => unknown> = (
  ...args: Parameters<Handler>
) => ReturnType<Handler>;

// biome-ignore lint/suspicious/noExplicitAny: not aware of a better solution in TS
export function useHandler<Handler extends (...args: Array<any>) => any>(
  handler: Handler,
): MemoizedHandler<Handler> {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // biome-ignore lint/correctness/useExhaustiveDependencies: noDeps is an empty array
  return useCallback((...args) => handlerRef.current(...args), noDeps);
}

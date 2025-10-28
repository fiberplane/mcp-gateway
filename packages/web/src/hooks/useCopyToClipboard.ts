import { useCallback, useEffect, useRef, useState } from "react";

interface UseCopyToClipboardOptions {
  /**
   * Duration in milliseconds to show the "copied" state
   * @default 2000
   */
  resetDelay?: number;
}

interface UseCopyToClipboardReturn<T> {
  /**
   * Copy data to clipboard
   * @param data - Data to copy (will be JSON.stringify'd)
   * @param type - Optional type identifier for tracking which item was copied
   */
  copy: (data: unknown, type?: T) => Promise<void>;

  /**
   * The type of the last copied item (null if nothing copied or after reset delay)
   */
  copiedType: T | null;

  /**
   * Whether the last copy operation failed
   */
  error: Error | null;
}

/**
 * Hook for copying data to clipboard with automatic cleanup
 *
 * @example
 * ```tsx
 * const { copy, copiedType } = useCopyToClipboard<'request' | 'response'>();
 *
 * <button onClick={() => copy(data, 'request')}>
 *   {copiedType === 'request' ? 'Copied!' : 'Copy'}
 * </button>
 * ```
 */
export function useCopyToClipboard<T = string>(
  options: UseCopyToClipboardOptions = {},
): UseCopyToClipboardReturn<T> {
  const { resetDelay = 2000 } = options;
  const [copiedType, setCopiedType] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);

  const copy = useCallback(
    async (data: unknown, type?: T) => {
      try {
        const text = JSON.stringify(data, null, 2);
        await navigator.clipboard.writeText(text);

        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set copied state (only if still mounted)
        if (mountedRef.current) {
          setCopiedType(type ?? null);
          setError(null);
        }

        // Reset after delay
        timeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current) {
            setCopiedType(null);
          }
        }, resetDelay);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(error);
        }
        // Error will be available via the error state, no need to log
      }
    },
    [resetDelay],
  );

  // Cleanup timeout on unmount and track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copy, copiedType, error };
}

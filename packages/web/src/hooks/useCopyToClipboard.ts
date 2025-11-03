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
   * Copy text to clipboard
   * @param text - Text to copy
   * @param contentId - Optional identifier for tracking which content was copied (useful when copying different items)
   */
  copy: (text: string, contentId?: T) => Promise<void>;

  /**
   * Simple boolean indicating if anything was copied recently
   */
  copied: boolean;

  /**
   * The identifier of the last copied content (null if nothing copied, no identifier provided, or after reset delay)
   */
  copiedId: T | null;

  /**
   * Whether the last copy operation failed
   */
  error: Error | null;
}

/**
 * Hook for copying text to clipboard with automatic cleanup
 *
 * The `contentId` parameter is optional and useful when you need to track which specific
 * content was copied (e.g., copying multiple different items and showing individual feedback).
 *
 * @example
 * Simple usage (just need boolean):
 * ```tsx
 * const { copy, copied } = useCopyToClipboard();
 *
 * <button onClick={() => copy("some text")}>
 *   {copied ? 'Copied!' : 'Copy'}
 * </button>
 * ```
 *
 * @example
 * Advanced usage (track which item):
 * ```tsx
 * const { copy, copiedId } = useCopyToClipboard<'request' | 'response'>();
 *
 * <button onClick={() => copy(requestData, 'request')}>
 *   {copiedId === 'request' ? 'Copied!' : 'Copy Request'}
 * </button>
 * <button onClick={() => copy(responseData, 'response')}>
 *   {copiedId === 'response' ? 'Copied!' : 'Copy Response'}
 * </button>
 * ```
 */
export function useCopyToClipboard<T = string>(
  options: UseCopyToClipboardOptions = {},
): UseCopyToClipboardReturn<T> {
  const { resetDelay = 2000 } = options;
  const [copiedId, setCopiedId] = useState<T | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);

  const copy = useCallback(
    async (text: string, contentId?: T) => {
      try {
        await navigator.clipboard.writeText(text);

        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Set copied state (only if still mounted)
        if (mountedRef.current) {
          setCopied(true);
          setCopiedId(contentId ?? null);
          setError(null);
        }

        // Reset after delay
        timeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current) {
            setCopied(false);
            setCopiedId(null);
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

  return { copy, copied, copiedId, error };
}

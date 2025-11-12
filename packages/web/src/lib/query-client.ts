import { QueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "./errors.js";

/**
 * Create a configured QueryClient with global error handling
 *
 * Configured with:
 * - 1 second polling interval for live updates
 * - No background refetching when tab is hidden
 * - Immediate staleness (always refetch on mount)
 * - Global auth error handling (invokes callback on 401)
 *
 * @param onAuthError Callback invoked when unauthorized errors are detected
 */
export function createQueryClient(onAuthError: () => void): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: 1000, // Poll every 1 second
        refetchIntervalInBackground: false, // Don't poll when tab is hidden
        staleTime: 0, // Consider data immediately stale
        retry: (failureCount, error) => {
          // Don't retry auth errors - invoke callback and stop
          if (error instanceof UnauthorizedError) {
            onAuthError();
            return false;
          }
          // Retry other errors up to 2 times
          return failureCount < 2;
        },
        refetchOnWindowFocus: false, // Don't refetch on window focus
      },
      mutations: {
        retry: (failureCount, error) => {
          // Don't retry auth errors - invoke callback and stop
          if (error instanceof UnauthorizedError) {
            onAuthError();
            return false;
          }
          // Retry mutations once
          return failureCount < 1;
        },
      },
    },
  });
}

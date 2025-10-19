import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query client configuration
 *
 * Configured with:
 * - 1 second polling interval for live updates
 * - No background refetching when tab is hidden
 * - Immediate staleness (always refetch on mount)
 * - 2 retries on failure
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 1000, // Poll every 1 second
      refetchIntervalInBackground: false, // Don't poll when tab is hidden
      staleTime: 0, // Consider data immediately stale
      retry: 2, // Retry failed requests twice
    },
  },
});

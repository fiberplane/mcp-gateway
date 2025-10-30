import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState, useQueryStates } from "nuqs";
import { useDeferredValue, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ExportButton } from "./components/export-button";
import { FilterBar } from "./components/filter-bar";
import { LogTable } from "./components/log-table";
import { Pagination } from "./components/pagination";
import { ServerTabs } from "./components/server-tabs";
import { SettingsMenu } from "./components/settings-menu";
import { StreamingBadge } from "./components/streaming-badge";
import { TopNavigation } from "./components/top-navigation";
import { api } from "./lib/api";
import {
  filterParamsToFilters,
  parseAsFilterParam,
  parseAsSearchArray,
} from "./lib/filter-parsers";
import { useHandler } from "./lib/use-handler";
import { getLogKey } from "./lib/utils";

function App() {
  const queryClient = useQueryClient();
  const [serverName, setServerName] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  // Filter state from URL via nuqs
  const [searchQueries] = useQueryState("search", parseAsSearchArray);

  const [filterParams] = useQueryStates({
    client: parseAsFilterParam,
    method: parseAsFilterParam,
    session: parseAsFilterParam,
    server: parseAsFilterParam,
    duration: parseAsFilterParam,
    tokens: parseAsFilterParam,
  });

  // Convert URL params to Filter array
  const filters = useMemo(
    () => filterParamsToFilters(filterParams),
    [filterParams],
  );

  // Streaming: ON = auto-refresh with new logs, OFF = manual load more
  const [isStreaming, setIsStreaming] = useState(true);

  // Extract filters and convert to API parameters
  // Backend now supports all filter types with proper operators
  const apiParams = useMemo(() => {
    const params: Parameters<typeof api.getLogs>[0] = {};

    // Extract each filter type
    for (const filter of filters) {
      // Use type guards to safely narrow filter types
      if (filter.field === "client") {
        params.clientName = filter.value; // Properly typed by discriminated union
      } else if (filter.field === "session") {
        params.sessionId = filter.value;
      } else if (filter.field === "method") {
        params.method = filter.value;
      } else if (filter.field === "duration") {
        // Map operator to specific param
        switch (filter.operator) {
          case "eq":
            params.durationEq = filter.value;
            break;
          case "gt":
            params.durationGt = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
          case "lt":
            params.durationLt = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
          case "gte":
            params.durationGte = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
          case "lte":
            params.durationLte = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
        }
      } else if (filter.field === "tokens") {
        // Map operator to specific param
        switch (filter.operator) {
          case "eq":
            params.tokensEq = filter.value;
            break;
          case "gt":
            params.tokensGt = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
          case "lt":
            params.tokensLt = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
          case "gte":
            params.tokensGte = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
          case "lte":
            params.tokensLte = Array.isArray(filter.value)
              ? filter.value[0]
              : filter.value;
            break;
        }
      } else if (filter.field === "server") {
        params.serverName = filter.value;
      }
    }

    return params;
  }, [filters]);

  // Fixed values (no UI controls)
  const timeGrouping = "day" as const; // Group by day

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    // Include URL state in queryKey so query automatically refetches when params change
    queryKey: ["logs", serverName, filterParams, searchQueries],
    queryFn: async ({ pageParam }) =>
      api.getLogs({
        q:
          searchQueries && searchQueries.length > 0 ? searchQueries : undefined,
        serverName,
        ...apiParams,
        limit: 100,
        before: pageParam,
        order: "desc", // Always descending - newest first
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // Paginate backwards (load older logs)
      if (lastPage.pagination.hasMore && lastPage.pagination.oldestTimestamp) {
        return lastPage.pagination.oldestTimestamp;
      }
      return undefined;
    },
    // Keep previous data during refetch for smoother UX
    placeholderData: (previousData) => previousData,
    // Conditional polling - only when streaming is on
    refetchInterval: isStreaming ? 5000 : false,
    refetchIntervalInBackground: false, // Only poll when tab is active
  });

  // Flatten all pages into single array
  // All filtering (search, duration, tokens, etc.) happens on backend
  const allLogs = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  );

  // Defer table updates to keep checkboxes responsive
  const deferredLogs = useDeferredValue(allLogs);

  const handleLoadMore = useHandler(() => {
    fetchNextPage();
  });

  const handleServerChange = useHandler((value: string | undefined) => {
    setServerName(value);
    setSelectedIds(new Set()); // Reset selection
  });

  const handleStreamingToggle = useHandler((enabled: boolean) => {
    setIsStreaming(enabled);
  });

  const handleClearSessions = useHandler(async (): Promise<void> => {
    // Ask for confirmation
    const confirmed = window.confirm(
      "Are you sure you want to clear all sessions? This will delete all captured logs and cannot be undone.",
    );

    if (!confirmed) {
      return; // User cancelled
    }

    setIsClearing(true);
    setClearError(null); // Clear any previous errors
    try {
      await api.clearSessions();
      // Invalidate all queries to refetch data after clearing (in parallel)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["logs"] }),
        queryClient.invalidateQueries({ queryKey: ["servers"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["clients"] }),
      ]);
      // Reset selection after successful clear
      setSelectedIds(new Set());
    } catch (error) {
      // Set user-facing error message
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      setClearError(`Failed to clear sessions: ${errorMessage}`);
      // biome-ignore lint/suspicious/noConsole: Error logging for debugging
      console.error("Failed to clear sessions:", error);
    } finally {
      setIsClearing(false);
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <h1 className="text-2xl font-semibold text-foreground mb-6">
          MCP server logs
        </h1>

        <div className="mb-6">
          <ServerTabs
            value={serverName}
            onChange={handleServerChange}
            panelId="logs-panel"
          />
        </div>

        {clearError && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive mb-5">
            {clearError}
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive mb-5">
            Error: {String(error)}
          </div>
        )}

        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground bg-card rounded-lg border border-border">
            Loading logs...
          </div>
        ) : (
          <>
            {/* Combined container: Filter Bar + Log Table with white background and border */}
            {/* biome-ignore lint/correctness/useUniqueElementIds: Static ID needed for ARIA tabpanel association */}
            <div
              id="logs-panel"
              role="tabpanel"
              className="bg-card rounded-lg border border-border p-4 gap-6 grid"
            >
              {/* Filter Bar - Phase 1-2 with two-row layout */}
              <ErrorBoundary
                fallback={(error) => (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
                    <p className="font-medium">Filter system unavailable</p>
                    <p className="text-sm mt-1">
                      Please refresh the page to try again.
                    </p>
                    {import.meta.env.DEV && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer">
                          Error details
                        </summary>
                        <pre className="mt-1 overflow-auto">
                          {error.message}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              >
                <FilterBar
                  actions={
                    <>
                      <StreamingBadge
                        isStreaming={isStreaming}
                        onToggle={handleStreamingToggle}
                      />
                      <SettingsMenu
                        onClearSessions={handleClearSessions}
                        isClearing={isClearing}
                      />
                      <ExportButton
                        logs={deferredLogs}
                        selectedIds={selectedIds}
                        getLogKey={getLogKey}
                      />
                    </>
                  }
                />
              </ErrorBoundary>

              {/* Log Table - wrapped for horizontal scroll */}
              <div className="overflow-x-auto -mx-4 px-4">
                <LogTable
                  logs={deferredLogs}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  timeGrouping={timeGrouping}
                />
              </div>
            </div>

            {/* Load More button at bottom */}
            <Pagination
              hasMore={hasNextPage || false}
              onLoadMore={handleLoadMore}
              isLoading={isFetchingNextPage}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;

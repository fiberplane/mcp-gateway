import {
  brandOperatorValue,
  isClientFilter,
  isDurationFilter,
  isMethodFilter,
  isServerFilter,
  isSessionFilter,
  isTokensFilter,
  type OperatorPrefixedValue,
} from "@fiberplane/mcp-gateway-types";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryState, useQueryStates } from "nuqs";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ExportButton } from "./components/export-button";
import { FiberplaneLogo } from "./components/fiberplane-logo";
import { FilterBar } from "./components/filter-bar";
import { LogTable } from "./components/log-table";
import { Pagination } from "./components/pagination";
import { ServerTabs } from "./components/server-tabs";
import { SettingsDropdown } from "./components/settings-dropdown";
import { StreamingBadge } from "./components/streaming-badge";
import { api } from "./lib/api";
import {
  filterParamsToFilters,
  parseAsFilterParam,
  parseAsSearchArray,
} from "./lib/filter-parsers";
import { useHandler } from "./lib/use-handler";
import { getLogKey } from "./lib/utils";

/**
 * API parameters for getLogs query
 */
type GetLogsParams = Parameters<typeof api.getLogs>[0];

/**
 * Helper to format string filter value with operator prefix for API
 * Converts filter operator and value into "operator:value" format with branded type
 * @example formatStringFilter("is", "claude-code") => "is:claude-code"
 * @example formatStringFilter("contains", ["foo", "bar"]) => ["contains:foo", "contains:bar"]
 */
function formatStringFilter(
  operator: string,
  value: string | string[],
): OperatorPrefixedValue | OperatorPrefixedValue[] {
  if (Array.isArray(value)) {
    return value.map((v) => brandOperatorValue(`${operator}:${v}`));
  }
  return brandOperatorValue(`${operator}:${value}`);
}

function App() {
  const logsPanelId = useId();
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
    const params: GetLogsParams = {};

    // Helper to extract first value from array or return single value
    const firstValue = (value: string | number | (string | number)[]) =>
      Array.isArray(value) ? value[0] : value;

    // Map numeric operators to API param names
    const numericOperatorMap: Record<
      string,
      Record<string, keyof GetLogsParams>
    > = {
      duration: {
        eq: "durationEq",
        gt: "durationGt",
        lt: "durationLt",
        gte: "durationGte",
        lte: "durationLte",
      },
      tokens: {
        eq: "tokensEq",
        gt: "tokensGt",
        lt: "tokensLt",
        gte: "tokensGte",
        lte: "tokensLte",
      },
    };

    // Process each filter using type predicates
    for (const filter of filters) {
      // Client filter
      if (isClientFilter(filter)) {
        params.clientName = formatStringFilter(
          filter.operator,
          filter.value,
        ) as never;
      }
      // Session filter
      else if (isSessionFilter(filter)) {
        params.sessionId = formatStringFilter(
          filter.operator,
          filter.value,
        ) as never;
      }
      // Method filter
      else if (isMethodFilter(filter)) {
        params.method = formatStringFilter(
          filter.operator,
          filter.value,
        ) as never;
      }
      // Server filter
      else if (isServerFilter(filter)) {
        params.serverName = formatStringFilter(
          filter.operator,
          filter.value,
        ) as never;
      }
      // Duration filter
      else if (isDurationFilter(filter)) {
        const operatorMap = numericOperatorMap.duration;
        const paramKey = operatorMap?.[filter.operator];
        if (paramKey) {
          params[paramKey] = firstValue(filter.value) as never;
        }
      }
      // Tokens filter
      else if (isTokensFilter(filter)) {
        const operatorMap = numericOperatorMap.tokens;
        const paramKey = operatorMap?.[filter.operator];
        if (paramKey) {
          params[paramKey] = firstValue(filter.value) as never;
        }
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
    queryKey: ["logs", serverName, apiParams, searchQueries],
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
      <header className="bg-card border-b border-border">
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <FiberplaneLogo className="text-foreground shrink-0" />
            <span className="text-base font-medium text-foreground">
              Fiberplane
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-foreground">
            MCP server logs
          </h1>
          <SettingsDropdown
            onClearSessions={handleClearSessions}
            isClearing={isClearing}
          />
        </div>

        <div className="mb-6">
          <ServerTabs
            value={serverName}
            onChange={handleServerChange}
            panelId={logsPanelId}
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
            <div
              id={logsPanelId}
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
                {deferredLogs.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    {filters.length > 0 || searchQueries?.length ? (
                      <>
                        <p className="mb-2">No logs match your filters</p>
                        <p className="text-sm">
                          Try adjusting your filters or search terms
                        </p>
                      </>
                    ) : (
                      <p>No logs captured yet</p>
                    )}
                  </div>
                ) : (
                  <LogTable
                    logs={deferredLogs}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    timeGrouping={timeGrouping}
                  />
                )}
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

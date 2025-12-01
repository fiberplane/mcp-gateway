import {
  brandOperatorValue,
  isClientFilter,
  isDurationFilter,
  isMethodFilter,
  isServerFilter,
  isSessionFilter,
  isStdioServer,
  isTokensFilter,
  type OperatorPrefixedValue,
} from "@fiberplane/mcp-gateway-types";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { useQueryState, useQueryStates } from "nuqs";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { EmptyStateNoLogs } from "../components/empty-state-no-logs";
import { EmptyStateNoServers } from "../components/empty-state-no-servers";
import { ExportButton } from "../components/export-button";
import { FilterBar } from "../components/filter-bar";
import { PageLayout } from "../components/layout/page-layout";
import { LogTable } from "../components/log-table";
import { PageHeader } from "../components/page-header";
import { Pagination } from "../components/pagination";
import { ServerHealthBanner } from "../components/server-health-banner";
import { ServerTabs } from "../components/server-tabs";
import { SettingsDropdown } from "../components/settings-dropdown";
import { StderrLogsViewer } from "../components/stderr-logs-viewer";
import { StdioProcessBanner } from "../components/stdio-process-banner";
import { StreamingBadge } from "../components/streaming-badge";

import { ErrorAlert } from "../components/ui/error-alert";
import { useApi } from "../contexts/ApiContext";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../hooks/use-confirm";
import { useHealthCheck } from "../hooks/use-health-check";
import {
  useFullServerConfig,
  useServerConfig,
} from "../hooks/use-server-configs";
import type { createApiClient } from "../lib/api";
import { POLLING_INTERVALS } from "../lib/constants";
import {
  filterParamsToFilters,
  parseAsFilterParam,
  parseAsSearchArray,
} from "../lib/filter-parsers";
import { useHandler } from "../lib/use-handler";
import { getLogKey } from "../lib/utils";

/**
 * API parameters for getLogs query (inferred from first call)
 */
type GetLogsParams = Parameters<
  ReturnType<typeof createApiClient>["getLogs"]
>[0];

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

function AppContent() {
  const logsPanelId = useId();
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const [serverName, setServerName] = useQueryState("server");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  // Get auth state and API client from context
  const { token, hasAuthError } = useAuth();
  const api = useApi();

  // Health check mutation
  const { mutate: checkHealth, isPending: isCheckingHealth } = useHealthCheck();

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

  // Get server config for health status (when viewing a specific server)
  const activeServerConfig = useServerConfig(serverName || "");

  // Get full server config for stdio servers (includes processState)
  const fullServerConfig = useFullServerConfig(serverName || "");

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
        params.clientName = formatStringFilter(filter.operator, filter.value);
      }
      // Session filter
      else if (isSessionFilter(filter)) {
        params.sessionId = formatStringFilter(filter.operator, filter.value);
      }
      // Method filter
      else if (isMethodFilter(filter)) {
        params.method = formatStringFilter(filter.operator, filter.value);
      }
      // Server filter
      else if (isServerFilter(filter)) {
        params.serverName = formatStringFilter(filter.operator, filter.value);
      }
      // Duration filter
      else if (isDurationFilter(filter)) {
        const operatorMap = numericOperatorMap.duration;
        const paramKey = operatorMap?.[filter.operator];
        if (paramKey) {
          (params as Record<string, number>)[paramKey] = firstValue(
            filter.value,
          ) as number;
        }
      }
      // Tokens filter
      else if (isTokensFilter(filter)) {
        const operatorMap = numericOperatorMap.tokens;
        const paramKey = operatorMap?.[filter.operator];
        if (paramKey) {
          (params as Record<string, number>)[paramKey] = firstValue(
            filter.value,
          ) as number;
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
    error: logsError,
  } = useInfiniteQuery({
    // Include URL state in queryKey so query automatically refetches when params change
    queryKey: ["logs", serverName, apiParams, searchQueries],
    queryFn: async ({ pageParam }) =>
      api.getLogs({
        q:
          searchQueries && searchQueries.length > 0 ? searchQueries : undefined,
        serverName: serverName ?? undefined,
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
    refetchInterval: isStreaming ? POLLING_INTERVALS.LOGS : false,
    refetchIntervalInBackground: false, // Only poll when tab is active
    enabled: !!token && !hasAuthError, // Only fetch logs when token is available and valid
  });

  // Flatten all pages into single array
  // All filtering (search, duration, tokens, etc.) happens on backend
  const allLogs = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data?.pages],
  );

  // Defer table updates to keep checkboxes responsive
  const deferredLogs = useDeferredValue(allLogs);

  // Fetch server list for empty state (when no logs exist)
  const hasLogs = allLogs.length > 0;
  const { data: serversData } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    // Only fetch when showing empty state (no logs captured yet) and token is available and valid
    enabled: !!token && !hasAuthError && !hasLogs,
    refetchInterval: !hasLogs ? POLLING_INTERVALS.SERVERS : false,
  });

  // Note: Error detection now handled globally by QueryClient in createQueryClient()

  const handleLoadMore = useHandler(() => {
    fetchNextPage();
  });

  const handleServerChange = useHandler((value: string | undefined) => {
    setServerName(value ?? null);
    if (selectedIds.size > 0) {
      // Reset selection if any are selected
      setSelectedIds(new Set());
    }
  });

  const handleStreamingToggle = useHandler((enabled: boolean) => {
    setIsStreaming(enabled);
  });

  const handleClearSessions = useHandler(async (): Promise<void> => {
    // Ask for confirmation with accessible dialog
    const confirmed = await confirm({
      title: "Clear Sessions",
      description:
        "Are you sure you want to clear all sessions? This will delete all captured logs and cannot be undone.",
      confirmText: "Clear Sessions",
      cancelText: "Cancel",
      variant: "destructive",
    });

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

      if (selectedIds.size > 0) {
        // Reset selection after successful clear
        setSelectedIds(new Set());
      }
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
    <>
      <ErrorBoundary
        fallback={(error) => (
          <PageLayout icon={<FileText className="h-4 w-4" />} breadcrumb="Logs">
            <div className="max-w-2xl mx-auto">
              <ErrorAlert
                error={error}
                title="Server management unavailable"
                retry={() => window.location.reload()}
              />
            </div>
          </PageLayout>
        )}
      >
        <PageLayout icon={<FileText className="h-4 w-4" />} breadcrumb="Logs">
          <PageHeader
            title="MCP server logs"
            actions={
              <SettingsDropdown
                onClearSessions={handleClearSessions}
                isClearing={isClearing}
              />
            }
          />

          <div className="mb-6">
            <ServerTabs
              value={serverName ?? undefined}
              onChange={handleServerChange}
              panelId={logsPanelId}
            />
          </div>

          {clearError && (
            <div className="mb-5" role="alert" aria-live="polite">
              <ErrorAlert error={clearError} title="Failed to clear sessions" />
            </div>
          )}

          {logsError && (
            <div className="mb-5" role="alert" aria-live="polite">
              <ErrorAlert
                error={logsError as Error}
                title="Failed to load logs"
              />
            </div>
          )}

          {isLoading ? (
            // biome-ignore lint/a11y/useSemanticElements: <output> not appropriate for loading status
            <div
              role="status"
              aria-live="polite"
              className="p-10 text-center text-muted-foreground bg-card rounded-lg border border-border"
            >
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

                {/* Server Health Banner - shown when viewing a single offline HTTP server */}
                {serverName &&
                  activeServerConfig &&
                  fullServerConfig &&
                  !isStdioServer(fullServerConfig) && (
                    <ServerHealthBanner
                      server={activeServerConfig}
                      onRetry={() => checkHealth(serverName)}
                      isRetrying={isCheckingHealth}
                    />
                  )}

                {/* Stdio Process Banner - shown for stdio servers (process state, restart) */}
                {serverName &&
                  fullServerConfig &&
                  isStdioServer(fullServerConfig) && (
                    <>
                      <StdioProcessBanner
                        server={fullServerConfig}
                        onRefresh={() => {
                          queryClient.invalidateQueries({
                            queryKey: ["server-configs"],
                          });
                        }}
                      />
                      <StderrLogsViewer server={fullServerConfig} />
                    </>
                  )}

                {/* Log Table - wrapped for horizontal scroll */}
                <div className="overflow-x-auto -mx-4 px-4">
                  {deferredLogs.length === 0 ? (
                    <div>
                      {filters.length > 0 || searchQueries?.length ? (
                        // Filtered empty state (when user has active filters or search)
                        <div className="p-10 text-center text-muted-foreground">
                          <p className="mb-2">No logs match your filters</p>
                          <p className="text-sm">
                            Try adjusting your filters or search terms
                          </p>
                        </div>
                      ) : serverName && activeServerConfig ? (
                        // When viewing a specific server with no logs
                        activeServerConfig.health === "down" ? (
                          // Offline server: just show simple message (banner above has details)
                          <div className="p-10 text-center text-muted-foreground">
                            <p className="mb-2">No logs captured yet</p>
                            <p className="text-sm">
                              Logs will appear here once the server is back
                              online and starts receiving requests
                            </p>
                          </div>
                        ) : (
                          // Online or unknown health: show instructions
                          <EmptyStateNoLogs servers={[activeServerConfig]} />
                        )
                      ) : serversData?.servers &&
                        serversData.servers.length > 0 ? (
                        // New "no logs" empty state (shows all servers)
                        <EmptyStateNoLogs servers={serversData.servers} />
                      ) : (
                        // New "no servers" empty state
                        <EmptyStateNoServers />
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
        </PageLayout>
      </ErrorBoundary>
      {ConfirmDialog}
    </>
  );
}

/**
 * HomePage component
 *
 * Renders the main logs view. All providers (Auth, API, QueryClient)
 * are now at the root level in __root.tsx.
 */
export default function HomePage() {
  return <AppContent />;
}

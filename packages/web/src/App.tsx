import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ExportButton } from "./components/export-button";
import { LogTable } from "./components/log-table";
import { Pagination } from "./components/pagination";
import { ServerFilter } from "./components/server-filter";
import { SessionFilter } from "./components/session-filter";
import { StreamingToggle } from "./components/streaming-toggle";
import { Button } from "./components/ui/button";
import { api } from "./lib/api";
import { useHandler } from "./lib/use-handler";
import { getLogKey } from "./lib/utils";

function App() {
  const queryClient = useQueryClient();
  const [serverName, setServerName] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  // Streaming: ON = auto-refresh with new logs, OFF = manual load more
  const [isStreaming, setIsStreaming] = useState(true);

  // Fixed values (no UI controls)
  const clientName = undefined; // All clients
  const timeGrouping = "day" as const; // Group by day

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ["logs", serverName, clientName, sessionId],
    queryFn: async ({ pageParam }) =>
      api.getLogs({
        serverName,
        clientName,
        sessionId,
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
    // Conditional polling - only when streaming is on
    refetchInterval: isStreaming ? 5000 : false,
    refetchIntervalInBackground: false, // Only poll when tab is active
  });

  // Flatten all pages into single array for display
  const allLogs = data?.pages.flatMap((page) => page.data) ?? [];

  const handleLoadMore = useHandler(() => {
    fetchNextPage();
  });

  const handleServerChange = useHandler((value: string | undefined) => {
    setServerName(value);
    setSessionId(undefined); // Reset session when server changes
    setSelectedIds(new Set()); // Reset selection
  });

  const handleSessionChange = useHandler((value: string | undefined) => {
    setSessionId(value);
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
      const errorMessage = error instanceof Error
        ? error.message
        : "An unknown error occurred";
      setClearError(`Failed to clear sessions: ${errorMessage}`);
      // biome-ignore lint/suspicious/noConsole: Error logging for debugging
      console.error("Failed to clear sessions:", error);
    } finally {
      setIsClearing(false);
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-5">
        <h1 className="text-2xl font-semibold text-foreground">
          MCP Gateway Logs
        </h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-5 flex gap-3 items-center flex-wrap">
          <ServerFilter value={serverName} onChange={handleServerChange} />
          <SessionFilter
            serverName={serverName}
            value={sessionId}
            onChange={handleSessionChange}
          />
          <StreamingToggle
            isStreaming={isStreaming}
            onToggle={handleStreamingToggle}
          />
          <div className="ml-auto flex gap-3">
            <Button
              variant="outline"
              onClick={handleClearSessions}
              disabled={isClearing}
            >
              {isClearing ? "Clearing..." : "Clear Sessions"}
            </Button>
            <ExportButton
              logs={allLogs}
              selectedIds={selectedIds}
              getLogKey={getLogKey}
            />
          </div>
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
          <div className="p-10 text-center text-muted-foreground bg-card rounded-lg">
            Loading logs...
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg overflow-auto border border-border max-h-[calc(100vh-16rem)]">
              <LogTable
                logs={allLogs}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                timeGrouping={timeGrouping}
              />
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

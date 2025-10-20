import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClientFilter } from "./components/client-filter";
import { ExportButton } from "./components/export-button";
import { LogTable } from "./components/log-table";
import { Pagination } from "./components/pagination";
import { ServerFilter } from "./components/server-filter";
import { SessionFilter } from "./components/session-filter";
import { StreamingToggle } from "./components/streaming-toggle";
import { api } from "./lib/api";
import { useHandler } from "./lib/use-handler";
import { getLogKey } from "./lib/utils";

function App() {
  const [serverName, setServerName] = useState<string | undefined>();
  const [clientName, setClientName] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Streaming: ON = auto-refresh with new logs, OFF = manual load more
  const [isStreaming, setIsStreaming] = useState(true);

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

  const handleClientChange = useHandler((value: string | undefined) => {
    setClientName(value);
    setSelectedIds(new Set()); // Reset selection
  });

  const handleSessionChange = useHandler((value: string | undefined) => {
    setSessionId(value);
    setSelectedIds(new Set()); // Reset selection
  });

  const handleStreamingToggle = useHandler((enabled: boolean) => {
    setIsStreaming(enabled);
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
          <ClientFilter value={clientName} onChange={handleClientChange} />
          <SessionFilter
            serverName={serverName}
            value={sessionId}
            onChange={handleSessionChange}
          />
          <StreamingToggle
            isStreaming={isStreaming}
            onToggle={handleStreamingToggle}
          />
          <div className="ml-auto">
            <ExportButton
              logs={allLogs}
              selectedIds={selectedIds}
              getLogKey={getLogKey}
            />
          </div>
        </div>

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

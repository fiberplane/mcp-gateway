import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ExportButton } from "./components/export-button";
import { LogTable } from "./components/log-table";
import { Pagination } from "./components/pagination";
import { ServerFilter } from "./components/server-filter";
import { SessionFilter } from "./components/session-filter";
import type { LogEntry } from "./lib/api";
import { api } from "./lib/api";
import { useHandler } from "./lib/use-handler";

function App() {
  const [serverName, setServerName] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [oldestTimestamp, setOldestTimestamp] = useState<string | undefined>();
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["logs", serverName, sessionId, oldestTimestamp],
    queryFn: () =>
      api.getLogs({
        serverName,
        sessionId,
        limit: 100,
        before: oldestTimestamp,
        order: "desc",
      }),
  });

  // Update accumulated logs when data changes
  useEffect(() => {
    if (!data) return;

    if (!oldestTimestamp) {
      // Fresh query - replace all logs
      setAllLogs(data.data);
    } else {
      // Loading more - append new logs
      setAllLogs((prev) => [...prev, ...data.data]);
    }
  }, [data, oldestTimestamp]);

  // Display logs - just use allLogs directly
  const logs = allLogs;

  // Helper function to generate unique log keys
  const getLogKey = (log: LogEntry) => {
    return `${log.timestamp}-${log.metadata.sessionId}-${log.id}`;
  };

  const handleLoadMore = useHandler(() => {
    if (data?.pagination.oldestTimestamp) {
      setOldestTimestamp(data.pagination.oldestTimestamp);
    }
  });

  const handleServerChange = useHandler((value: string | undefined) => {
    setServerName(value);
    setSessionId(undefined); // Reset session when server changes
    setOldestTimestamp(undefined);
    setAllLogs([]);
    setSelectedIds(new Set()); // Reset selection
  });

  const handleSessionChange = useHandler((value: string | undefined) => {
    setSessionId(value);
    setOldestTimestamp(undefined);
    setAllLogs([]);
    setSelectedIds(new Set()); // Reset selection
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
          <div className="ml-auto">
            <ExportButton
              logs={logs}
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

        {isLoading && !oldestTimestamp ? (
          <div className="p-10 text-center text-muted-foreground bg-card rounded-lg">
            Loading logs...
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg overflow-hidden border border-border">
              <LogTable
                logs={logs}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            </div>
            <Pagination
              hasMore={data?.pagination.hasMore || false}
              onLoadMore={handleLoadMore}
              isLoading={isLoading}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;

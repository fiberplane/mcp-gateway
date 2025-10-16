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
  });

  const handleSessionChange = useHandler((value: string | undefined) => {
    setSessionId(value);
    setOldestTimestamp(undefined);
    setAllLogs([]);
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
      }}
    >
      <header
        style={{
          background: "white",
          padding: "20px 24px",
          borderBottom: "1px solid #eee",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 600,
            margin: 0,
          }}
        >
          MCP Gateway Logs
        </h1>
      </header>

      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "24px",
        }}
      >
        <div
          style={{
            marginBottom: "20px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <ServerFilter value={serverName} onChange={handleServerChange} />
          <SessionFilter
            serverName={serverName}
            value={sessionId}
            onChange={handleSessionChange}
          />
          <div style={{ marginLeft: "auto" }}>
            <ExportButton serverName={serverName} sessionId={sessionId} />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "16px",
              background: "#fee",
              border: "1px solid #fcc",
              borderRadius: "4px",
              color: "#c00",
              marginBottom: "20px",
            }}
          >
            Error: {String(error)}
          </div>
        )}

        {isLoading && !oldestTimestamp ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "#666",
              background: "white",
              borderRadius: "8px",
            }}
          >
            Loading logs...
          </div>
        ) : (
          <>
            <div style={{ background: "white", borderRadius: "8px" }}>
              <LogTable logs={logs} />
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

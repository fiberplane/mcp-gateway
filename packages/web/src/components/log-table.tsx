import { format } from "date-fns";
import { Fragment, useState } from "react";
import type { LogEntry } from "../lib/api";
import { useHandler } from "../lib/use-handler";

interface LogTableProps {
  logs: LogEntry[];
}

export function LogTable({ logs }: LogTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const getLogKey = (log: LogEntry) => {
    // Create a unique key from timestamp + sessionId + id
    return `${log.timestamp}-${log.metadata.sessionId}-${log.id}`;
  };

  const handleRowClick = useHandler((log: LogEntry) => {
    const key = getLogKey(log);
    setExpandedKey((current) => (current === key ? null : key));
  });

  if (logs.length === 0) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#666",
          background: "white",
          borderRadius: "8px",
        }}
      >
        No logs found
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Server</th>
          <th>Session</th>
          <th>Method</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => {
          const logKey = getLogKey(log);
          const isExpanded = expandedKey === logKey;

          return (
            <Fragment key={logKey}>
              <tr
                key={logKey}
                onClick={() => handleRowClick(log)}
                style={{
                  cursor: "pointer",
                  background: isExpanded ? "#f0f7ff" : undefined,
                }}
              >
                <td style={{ fontFamily: "monospace", fontSize: "13px" }}>
                  {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
                </td>
                <td>{log.metadata.serverName}</td>
                <td
                  style={{
                    fontFamily: "monospace",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  {log.metadata.sessionId.slice(0, 8)}...
                </td>
                <td>
                  <code
                    style={{
                      background: "#f0f0f0",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontSize: "13px",
                    }}
                  >
                    {log.method}
                  </code>
                </td>
                <td style={{ color: "#666" }}>{log.metadata.durationMs}ms</td>
              </tr>
              {isExpanded && (
                <tr key={`${logKey}-details`}>
                  <td
                    colSpan={5}
                    style={{
                      padding: "20px",
                      background: "#fafafa",
                    }}
                  >
                    <LogDetails log={log} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

interface LogDetailsProps {
  log: LogEntry;
}

function LogDetails({ log }: LogDetailsProps) {
  const [copied, setCopied] = useState<"request" | "response" | null>(null);

  const copyToClipboard = useHandler(
    (data: unknown, type: "request" | "response") => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    },
  );

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {log.request ? (
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <h4 style={{ fontSize: "14px", fontWeight: 600 }}>Request</h4>
            <button
              type="button"
              onClick={() => copyToClipboard(log.request, "request")}
            >
              {copied === "request" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              background: "white",
              border: "1px solid #eee",
              maxHeight: "400px",
            }}
          >
            {JSON.stringify(log.request, null, 2)}
          </pre>
        </div>
      ) : null}
      {log.response ? (
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}
          >
            <h4 style={{ fontSize: "14px", fontWeight: 600 }}>Response</h4>
            <button
              type="button"
              onClick={() => copyToClipboard(log.response, "response")}
            >
              {copied === "response" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <pre
            style={{
              background: "white",
              border: "1px solid #eee",
              maxHeight: "400px",
            }}
          >
            {JSON.stringify(log.response, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { LogEntry } from "../lib/api";
import { getMethodBadgeVariant } from "../lib/badge-color";
import { useHandler } from "../lib/use-handler";
import { getLogKey } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

type SortField = "timestamp" | "server" | "session" | "method" | "duration";
type SortDirection = "asc" | "desc";

interface LogTableProps {
  logs: LogEntry[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

interface SortHeaderProps {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}

function SortHeader({
  field,
  sortField,
  sortDirection,
  onSort,
  children,
}: SortHeaderProps) {
  const isActive = sortField === field;
  const Icon = isActive
    ? sortDirection === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground w-full hover:bg-muted transition-colors cursor-pointer"
    >
      {children}
      <Icon
        className={`w-4 h-4 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
      />
    </button>
  );
}

export function LogTable({
  logs,
  selectedIds,
  onSelectionChange,
}: LogTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = useHandler((field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      // New field - default to descending
      setSortField(field);
      setSortDirection("desc");
    }
  });

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "timestamp":
          aValue = a.timestamp;
          bValue = b.timestamp;
          break;
        case "server":
          aValue = a.metadata.serverName;
          bValue = b.metadata.serverName;
          break;
        case "session":
          aValue = a.metadata.sessionId;
          bValue = b.metadata.sessionId;
          break;
        case "method":
          aValue = a.method;
          bValue = b.method;
          break;
        case "duration":
          aValue = a.metadata.durationMs;
          bValue = b.metadata.durationMs;
          break;
      }

      const comparison =
        typeof aValue === "string"
          ? aValue.localeCompare(bValue as string)
          : aValue - (bValue as number);

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [logs, sortField, sortDirection]);

  const handleSelectAll = useHandler((checked: boolean) => {
    if (checked) {
      const allIds = new Set(sortedLogs.map(getLogKey));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  });

  const handleRowClick = useHandler((log: LogEntry) => {
    const key = getLogKey(log);
    setExpandedKey((current) => (current === key ? null : key));
  });

  const handleSelectRow = useHandler((logKey: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(logKey);
    } else {
      newSelection.delete(logKey);
    }
    onSelectionChange(newSelection);
  });

  const allSelected =
    sortedLogs.length > 0 &&
    sortedLogs.every((log) => selectedIds.has(getLogKey(log)));

  if (logs.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground bg-card rounded-lg">
        No logs found
      </div>
    );
  }

  return (
    <table className="w-full border-collapse">
      <thead className="border-b border-border">
        <tr>
          <th className="w-12 p-3">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <SortHeader
              field="timestamp"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Timestamp
            </SortHeader>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <SortHeader
              field="server"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Server
            </SortHeader>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <SortHeader
              field="session"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Session
            </SortHeader>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <SortHeader
              field="method"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Method
            </SortHeader>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <SortHeader
              field="duration"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            >
              Duration
            </SortHeader>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {sortedLogs.map((log) => {
          const logKey = getLogKey(log);
          const isExpanded = expandedKey === logKey;

          return (
            <Fragment key={logKey}>
              <tr
                key={logKey}
                className={`hover:bg-muted/50 transition-colors ${
                  isExpanded ? "bg-blue-50/50" : ""
                }`}
              >
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: Checkbox cell stops propagation */}
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(logKey)}
                    onCheckedChange={(checked) =>
                      handleSelectRow(logKey, checked as boolean)
                    }
                    aria-label={`Select log ${logKey}`}
                  />
                </td>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: Table row click for expand/collapse, keyboard nav to be added */}
                <td
                  className="p-3 font-mono text-sm text-foreground cursor-pointer"
                  title={log.timestamp}
                  onClick={() => handleRowClick(log)}
                >
                  {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
                </td>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: Table row click for expand/collapse, keyboard nav to be added */}
                <td
                  className="p-3 text-sm text-foreground cursor-pointer"
                  onClick={() => handleRowClick(log)}
                >
                  {log.metadata.serverName}
                </td>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: Table row click for expand/collapse, keyboard nav to be added */}
                <td
                  className="p-3 font-mono text-xs text-muted-foreground cursor-pointer"
                  onClick={() => handleRowClick(log)}
                >
                  {log.metadata.sessionId.slice(0, 8)}...
                </td>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: Table row click for expand/collapse, keyboard nav to be added */}
                <td
                  className="p-3 cursor-pointer"
                  onClick={() => handleRowClick(log)}
                >
                  <Badge
                    variant={getMethodBadgeVariant(log.method)}
                    className="inline-flex items-center gap-1"
                  >
                    {log.direction === "request" ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )}
                    <span>{log.method}</span>
                  </Badge>
                </td>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: Table row click for expand/collapse, keyboard nav to be added */}
                <td
                  className="p-3 text-sm text-muted-foreground cursor-pointer"
                  onClick={() => handleRowClick(log)}
                >
                  {log.metadata.durationMs}ms
                </td>
              </tr>
              {isExpanded && (
                <tr key={`${logKey}-details`}>
                  <td colSpan={6} className="p-5 bg-muted/30">
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

  // Memoize formatted JSON to avoid re-stringifying on every render
  const formattedRequest = useMemo(
    () => (log.request ? JSON.stringify(log.request, null, 2) : null),
    [log.request],
  );

  const formattedResponse = useMemo(
    () => (log.response ? JSON.stringify(log.response, null, 2) : null),
    [log.response],
  );

  const copyToClipboard = useHandler(
    (data: unknown, type: "request" | "response") => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    },
  );

  return (
    <div className="flex gap-5">
      {formattedRequest ? (
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2.5">
            <h4 className="text-sm font-semibold text-foreground">Request</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(log.request, "request")}
            >
              {copied === "request" ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <pre className="bg-card border border-border rounded-md p-4 overflow-auto max-h-96 text-xs font-mono">
            {formattedRequest}
          </pre>
        </div>
      ) : null}
      {formattedResponse ? (
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2.5">
            <h4 className="text-sm font-semibold text-foreground">Response</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(log.response, "response")}
            >
              {copied === "response" ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <pre className="bg-card border border-border rounded-md p-4 overflow-auto max-h-96 text-xs font-mono">
            {formattedResponse}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

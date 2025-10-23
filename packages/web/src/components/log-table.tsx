import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
} from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { getMethodBadgeVariant } from "../lib/badge-color";
import { groupLogsByTime, type TimeInterval } from "../lib/time-grouping";
import { useHandler } from "../lib/use-handler";
import { getLogKey } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

type SortField =
  | "timestamp"
  | "server"
  | "session"
  | "method"
  | "duration"
  | "client";
type SortDirection = "asc" | "desc";

/**
 * Column configuration for the log table
 */
interface Column {
  id: string;
  header: string | (() => ReactNode);
  cell: (log: ApiLogEntry) => ReactNode;
  sortField?: SortField;
  size?: string | number;
  isVisible?: (logs: ApiLogEntry[]) => boolean;
}

/**
 * Row items can be either a time divider or a log entry
 */
type RowItem =
  | { type: "divider"; label: string; groupKey: string }
  | { type: "log"; log: ApiLogEntry };

interface LogTableProps {
  logs: ApiLogEntry[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  timeGrouping?: TimeInterval;
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
  timeGrouping = "day",
}: LogTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Define columns configuration
  const columns = useMemo(() => createColumns(), []);

  // Filter visible columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => !col.isVisible || col.isVisible(logs)),
    [columns, logs],
  );

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
        case "client":
          aValue = a.metadata.client?.name || "";
          bValue = b.metadata.client?.name || "";
          break;
      }

      const comparison =
        typeof aValue === "string"
          ? aValue.localeCompare(bValue as string)
          : aValue - (bValue as number);

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [logs, sortField, sortDirection]);

  // Group logs by time interval and create rows with dividers
  const rowsWithDividers = useMemo(() => {
    const { groups, config } = groupLogsByTime(sortedLogs, timeGrouping);
    const result: RowItem[] = [];

    if (sortedLogs.length === 0) {
      return result;
    }

    // Get the current time's group key to check if a group is "current"
    const now = new Date();
    const currentGroupKey = config.getGroupKey(now);

    // Sort group keys (respect current sort direction for display order)
    const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
      return sortDirection === "desc" ? b.localeCompare(a) : a.localeCompare(b);
    });

    for (let i = 0; i < sortedGroupKeys.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: Array index is within bounds
      const groupKey = sortedGroupKeys[i]!;
      // biome-ignore lint/style/noNonNullAssertion: We know the key exists
      const groupLogs = groups.get(groupKey)!;
      // biome-ignore lint/style/noNonNullAssertion: Groups always have at least one log
      const firstLog = groupLogs[0]!;
      const label = config.formatLabel(new Date(firstLog.timestamp));

      // Skip divider for the current time period
      // Only show dividers when transitioning to older time periods
      const isCurrentPeriod = groupKey === currentGroupKey;
      if (!isCurrentPeriod) {
        result.push({ type: "divider", label, groupKey });
      }

      // Add logs
      for (const log of groupLogs) {
        result.push({ type: "log", log });
      }
    }

    return result;
  }, [sortedLogs, timeGrouping, sortDirection]);

  const handleSelectAll = useHandler((checked: boolean) => {
    if (checked) {
      const allIds = new Set(sortedLogs.map(getLogKey));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
  });

  const handleRowClick = useHandler((log: ApiLogEntry) => {
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
          {visibleColumns.map((column) => (
            <th
              key={column.id}
              className="text-left p-3 text-sm font-semibold text-foreground"
            >
              {column.sortField ? (
                <SortHeader
                  field={column.sortField}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                >
                  {typeof column.header === "function"
                    ? column.header()
                    : column.header}
                </SortHeader>
              ) : typeof column.header === "function" ? (
                column.header()
              ) : (
                column.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rowsWithDividers.map((item) => {
          // Render divider row
          if (item.type === "divider") {
            return (
              <tr
                key={`divider-${item.groupKey}`}
                className="bg-muted/30 border-t-2 border-border"
              >
                <td
                  colSpan={visibleColumns.length + 1}
                  className="p-3 text-sm font-semibold text-muted-foreground text-center"
                >
                  {item.label}
                </td>
              </tr>
            );
          }

          // Render log row
          const log = item.log;
          const logKey = getLogKey(log);
          const isExpanded = expandedKey === logKey;

          return (
            <Fragment key={logKey}>
              <tr
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
                {visibleColumns.map((column) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: Table row click for expand/collapse, keyboard nav to be added
                  <td
                    key={column.id}
                    className="p-3 cursor-pointer"
                    onClick={() => handleRowClick(log)}
                  >
                    {column.cell(log)}
                  </td>
                ))}
              </tr>
              {isExpanded && (
                <tr key={`${logKey}-details`}>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="p-5 bg-muted/30"
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
  log: ApiLogEntry;
}

function createColumns(): Column[] {
  return [
    {
      id: "timestamp",
      header: "Timestamp",
      sortField: "timestamp",
      cell: (log) => (
        <span
          className="font-mono text-sm text-foreground"
          title={log.timestamp}
        >
          {format(new Date(log.timestamp), "HH:mm:ss.SSS")}
        </span>
      ),
    },
    {
      id: "client",
      header: "Client",
      sortField: "client",
      cell: (log) =>
        log.metadata.client ? (
          <div className="flex flex-col">
            <span className="font-medium">{log.metadata.client.name}</span>
            <span className="text-xs text-muted-foreground">
              {log.metadata.client.version}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "method",
      header: "Method",
      sortField: "method",
      cell: (log) => (
        <Badge
          variant={getMethodBadgeVariant(log.method)}
          className="inline-flex items-center gap-1"
        >
          {log.direction === "request" ? (
            <ArrowRight className="w-3 h-3" />
          ) : log.direction === "response" ? (
            <ArrowLeft className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )}
          <span>{log.method}</span>
        </Badge>
      ),
    },
    {
      id: "server",
      header: "Server",
      sortField: "server",
      isVisible: (logs) => logs.some((log) => log.metadata.server),
      cell: (log) =>
        log.metadata.server ? (
          <div className="flex flex-col">
            <span className="font-medium">{log.metadata.server.name}</span>
            <span className="text-xs text-muted-foreground">
              {log.metadata.server.version}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "session",
      header: "Session",
      sortField: "session",
      cell: (log) => (
        <span className="font-mono text-xs text-muted-foreground">
          {log.metadata.sessionId.slice(0, 8)}...
        </span>
      ),
    },
    {
      id: "duration",
      header: "Duration",
      sortField: "duration",
      cell: (log) => (
        <span className="text-sm text-muted-foreground">
          {log.metadata.durationMs}ms
        </span>
      ),
    },
  ];
}

function LogDetails({ log }: LogDetailsProps) {
  const [copied, setCopied] = useState<
    "request" | "response" | "sseEvent" | null
  >(null);

  const isNotification = log.id === null;

  const responseError = useMemo(() => {
    if (log.direction !== "response") {
      return null;
    }

    if (!log.response || typeof log.response !== "object") {
      return null;
    }

    return log.response.error ?? null;
  }, [log]);

  const metadataDetails = useMemo(() => {
    const items: Array<{ label: string; value: ReactNode }> = [];

    items.push({ label: "Session ID", value: log.metadata.sessionId });

    items.push({
      label: "JSON-RPC ID",
      value: isNotification ? "Notification" : String(log.id),
    });

    if (log.direction === "response" && log.metadata.httpStatus > 0) {
      items.push({ label: "HTTP Status", value: log.metadata.httpStatus });
    }

    if (log.direction === "sse-event") {
      if (log.metadata.sseEventId) {
        items.push({ label: "SSE Event ID", value: log.metadata.sseEventId });
      }
      if (log.metadata.sseEventType) {
        items.push({
          label: "SSE Event Type",
          value: log.metadata.sseEventType,
        });
      }
    }

    if (log.metadata.clientIp && log.metadata.clientIp !== "unknown") {
      items.push({ label: "Client IP", value: log.metadata.clientIp });
    }

    if (log.metadata.userAgent) {
      items.push({ label: "User Agent", value: log.metadata.userAgent });
    }

    if (log.metadata.client?.title) {
      items.push({ label: "Client Title", value: log.metadata.client.title });
    }

    if (log.metadata.server?.title) {
      items.push({ label: "Server Title", value: log.metadata.server.title });
    }

    return items;
  }, [
    isNotification,
    log.direction,
    log.id,
    log.metadata.client?.title,
    log.metadata.clientIp,
    log.metadata.httpStatus,
    log.metadata.server?.title,
    log.metadata.sessionId,
    log.metadata.sseEventId,
    log.metadata.sseEventType,
    log.metadata.userAgent,
  ]);

  const formattedRequest = useMemo(() => {
    if (log.direction !== "request") {
      return null;
    }

    const requestLog = log;
    return JSON.stringify(requestLog.request, null, 2);
  }, [log]);

  const formattedResponse = useMemo(() => {
    if (log.direction !== "response") {
      return null;
    }

    return JSON.stringify(log.response, null, 2);
  }, [log]);

  const formattedSseEvent = useMemo(() => {
    if (log.direction !== "sse-event") {
      return null;
    }

    return {
      id: log.sseEvent?.id || "—",
      event: log.sseEvent?.event || "—",
      data: log.sseEvent?.data || "—",
      retry: log.sseEvent?.retry ? String(log.sseEvent.retry) : "—",
    };
  }, [log]);

  const copyToClipboard = useHandler(
    (data: unknown, type: "request" | "response" | "sseEvent") => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    },
  );

  return (
    <div className="flex flex-col gap-5">
      {metadataDetails.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metadataDetails.map((item) => (
            <div
              key={`${item.label}-${String(item.value)}`}
              className="rounded-md border border-border bg-muted/30 p-3"
            >
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 break-all text-sm text-foreground">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {responseError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="font-semibold">JSON-RPC Error</div>
          <div className="mt-1">
            {responseError.code != null ? `Code ${responseError.code}: ` : null}
            {responseError.message ?? "Unknown error"}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 md:flex-row">
        {formattedRequest && log.direction === "request" ? (
          <div className="flex-1">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Request</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(log.request, "request")}
              >
                {copied === "request" ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-border bg-card p-4 text-xs font-mono">
              {formattedRequest}
            </pre>
          </div>
        ) : null}
        {formattedResponse &&
        !isNotification &&
        log.direction === "response" ? (
          <div className="flex-1">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Response
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(log.response, "response")}
              >
                {copied === "response" ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md border border-border bg-card p-4 text-xs font-mono">
              {formattedResponse}
            </pre>
          </div>
        ) : null}
        {formattedSseEvent && log.direction === "sse-event" ? (
          <div className="flex-1">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                SSE Event
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(formattedSseEvent, "sseEvent")}
              >
                {copied === "sseEvent" ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Event ID
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {formattedSseEvent.id}
                </div>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Event Type
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {formattedSseEvent.event}
                </div>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Data
                </div>
                <pre className="mt-1 max-h-48 overflow-auto rounded-sm bg-muted p-2 text-xs font-mono text-foreground">
                  {formattedSseEvent.data}
                </pre>
              </div>
              {formattedSseEvent.retry !== "—" && (
                <div className="rounded-md border border-border bg-card p-4">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Retry (ms)
                  </div>
                  <div className="mt-1 font-mono text-sm text-foreground">
                    {formattedSseEvent.retry}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
  TriangleAlert,
} from "lucide-react";
import {
  Fragment,
  type ReactNode,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { getMethodColor } from "../lib/method-colors";
import { getMethodDetail } from "../lib/method-detail";
import { groupLogsByTime, type TimeInterval } from "../lib/time-grouping";
import { useHandler } from "../lib/use-handler";
import { cn, getLogKey } from "../lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ColorPill } from "./ui/color-pill";

type SortField =
  | "timestamp"
  | "server"
  | "session"
  | "method"
  | "methodDetail"
  | "duration"
  | "client"
  | "tokens";
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
  /** Optional className for the header <th> element */
  headerClassName?: string;
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
      className="flex items-center gap-1 hover:text-foreground w-full hover:bg-muted transition-colors cursor-pointer group"
    >
      {children}
      <Icon
        className={`w-4 h-4 ${isActive ? "text-foreground" : "text-muted-foreground"} group-hover:text-foreground`}
      />
    </button>
  );
}

/**
 * Column definitions for the log table.
 * Defined outside component to prevent recreation on every render.
 */
const COLUMNS: Column[] = [
  {
    id: "timestamp",
    header: "Timestamp",
    sortField: "timestamp",
    headerClassName: "min-w-32",
    cell: (log) => (
      <span
        className="font-mono text-sm text-foreground min-w-0 truncate"
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
    headerClassName: "min-w-40",
    cell: (log) =>
      log.metadata.client ? (
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-medium truncate min-w-0">
            {log.metadata.client.name}
          </span>
          <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
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
    headerClassName: "min-w-44",
    cell: (log) => {
      const icon =
        log.direction === "request" ? (
          <ArrowRight className="w-3 h-3 shrink-0" aria-hidden="true" />
        ) : log.direction === "response" ? (
          <ArrowLeft className="w-3 h-3 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowDown className="w-3 h-3" aria-hidden="true" />
        );

      return (
        <ColorPill
          color={getMethodColor(log.method)}
          icon={icon}
          className="min-w-0 truncate"
        >
          {log.method}
        </ColorPill>
      );
    },
  },
  {
    id: "methodDetail",
    header: "Method detail",
    sortField: "methodDetail",
    headerClassName: "min-w-44",
    cell: (log) => {
      const detail = getMethodDetail(log);

      // Parse error - show dash + warning icon
      if (detail === null) {
        return (
          <span
            className="inline-flex items-center gap-1 text-destructive text-sm"
            title="Failed to parse request/response parameters. Check browser console for details."
          >
            <span className="text-muted-foreground">−</span>
            <TriangleAlert className="w-3 h-3" />
          </span>
        );
      }

      // Empty/not applicable
      if (!detail) {
        return <span className="text-muted-foreground">−</span>;
      }

      // Normal content
      const isLong = detail.length > 40;
      return (
        <span
          className="text-sm text-muted-foreground truncate max-w-[200px] inline-block"
          title={isLong ? detail : undefined}
        >
          {detail}
        </span>
      );
    },
  },
  {
    id: "server",
    header: "Server",
    sortField: "server",
    headerClassName: "min-w-40",
    isVisible: (logs) => logs.some((log) => log.metadata.server),
    cell: (log) =>
      log.metadata.server ? (
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-medium truncate min-w-0">
            {log.metadata.server.name}
          </span>
          <span className="text-medium text-muted-foreground whitespace-nowrap flex-shrink-0">
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
    headerClassName: "min-w-28",
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
    headerClassName: "min-w-24",
    cell: (log) => (
      <span className="text-sm text-muted-foreground">
        {log.metadata.durationMs}ms
      </span>
    ),
  },
  {
    id: "tokens",
    header: "Tokens",
    sortField: "tokens",
    headerClassName: "min-w-24",
    cell: (log) => {
      const inputTokens = log.metadata.inputTokens;
      const outputTokens = log.metadata.outputTokens;

      // If both are undefined, this method has no token cost (N/A)
      if (inputTokens === undefined && outputTokens === undefined) {
        return <span className="text-muted-foreground">−</span>;
      }

      // Calculate total (treating undefined as 0)
      const total = (inputTokens ?? 0) + (outputTokens ?? 0);

      // Build tooltip with only present values
      const tooltipParts: string[] = [];
      if (inputTokens !== undefined) {
        tooltipParts.push(`Input: ${inputTokens}`);
      }
      if (outputTokens !== undefined) {
        tooltipParts.push(`Output: ${outputTokens}`);
      }
      const tooltip = tooltipParts.join(", ");

      return (
        <span
          className="text-sm text-muted-foreground tabular-nums text-right"
          title={tooltip}
        >
          {total.toLocaleString()}
        </span>
      );
    },
  },
];

export function LogTable({
  logs,
  selectedIds,
  onSelectionChange,
  timeGrouping = "day",
}: LogTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Defer expensive table updates to keep UI responsive
  const deferredLogs = useDeferredValue(logs);

  // Filter visible columns based on log data
  const visibleColumns = useMemo(
    () =>
      COLUMNS.filter((col) => !col.isVisible || col.isVisible(deferredLogs)),
    [deferredLogs],
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
    return [...deferredLogs].sort((a, b) => {
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
        case "methodDetail": {
          const aDetail = a.metadata.methodDetail ?? "";
          const bDetail = b.metadata.methodDetail ?? "";

          // Sort empty values to end for better UX
          if (!aDetail && bDetail) {
            return sortDirection === "asc" ? 1 : -1;
          }
          if (aDetail && !bDetail) {
            return sortDirection === "asc" ? -1 : 1;
          }

          aValue = aDetail;
          bValue = bDetail;
          break;
        }
        case "tokens": {
          const aTokens =
            (a.metadata.inputTokens ?? 0) + (a.metadata.outputTokens ?? 0);
          const bTokens =
            (b.metadata.inputTokens ?? 0) + (b.metadata.outputTokens ?? 0);
          const aHasTokens = aTokens > 0;
          const bHasTokens = bTokens > 0;

          if (aHasTokens !== bHasTokens) {
            // Always push zero-token entries to the end regardless of sort direction
            return aHasTokens ? -1 : 1;
          }

          const tokenComparison = aTokens - bTokens;
          return sortDirection === "asc" ? tokenComparison : -tokenComparison;
        }
      }

      const comparison =
        typeof aValue === "string" && typeof bValue === "string"
          ? aValue.localeCompare(bValue)
          : typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : 0; // Fallback for type mismatch (shouldn't happen)

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [deferredLogs, sortField, sortDirection]);

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
      const groupKey = sortedGroupKeys[i];
      if (!groupKey) continue;

      const groupLogs = groups.get(groupKey);
      if (!groupLogs || groupLogs.length === 0) continue;

      const firstLog = groupLogs[0];
      if (!firstLog) continue;

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

  const handleSelectRow = useHandler(
    (logKey: string, checked: boolean | "indeterminate") => {
      if (checked === "indeterminate") return;
      const newSelection = new Set(selectedIds);
      if (checked) {
        newSelection.add(logKey);
      } else {
        newSelection.delete(logKey);
      }
      onSelectionChange(newSelection);
    },
  );

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
    <table className="w-full border-collapse table-fixed">
      <thead className="border-b border-border">
        <tr>
          <th className="w-9 px-3 h-8">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all"
            />
          </th>
          {visibleColumns.map((column) => (
            <th
              key={column.id}
              className={cn(
                "text-left h-8 px-2 text-sm font-semibold text-foreground",
                column.headerClassName,
              )}
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
                  className="h-8 text-sm font-semibold text-muted-foreground text-center"
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
              {/* biome-ignore lint/a11y/useSemanticElements: Table row with button behavior for expand/collapse */}
              <tr
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`Log entry for ${log.method} at ${format(new Date(log.timestamp), "HH:mm:ss")}`}
                className={cn(
                  "hover:bg-muted/50 transition-colors cursor-pointer",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isExpanded && "bg-blue-50/50",
                )}
                onClick={() => handleRowClick(log)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRowClick(log);
                  }
                }}
              >
                <td
                  className="p-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                    }
                  }}
                >
                  <Checkbox
                    checked={selectedIds.has(logKey)}
                    onCheckedChange={(checked) =>
                      handleSelectRow(logKey, checked)
                    }
                    aria-label={`Select log ${logKey}`}
                  />
                </td>
                {visibleColumns.map((column) => (
                  <td key={column.id} className="p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {column.cell(log)}
                    </div>
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

function LogDetails({ log }: LogDetailsProps) {
  const { copy: copyToClipboard, copiedId: copied } = useCopyToClipboard<
    "request" | "response" | "sseEvent"
  >();

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
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(log.request, null, 2),
                    "request",
                  )
                }
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
            <pre className="max-h-96 max-w-full overflow-auto rounded-md border border-border bg-card p-4 text-xs font-mono">
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
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(log.response, null, 2),
                    "response",
                  )
                }
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
            <pre className="max-h-96 max-w-full overflow-auto rounded-md border border-border bg-card p-4 text-xs font-mono">
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
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(formattedSseEvent, null, 2),
                    "sseEvent",
                  )
                }
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
                <pre className="mt-1 max-h-48 max-w-full overflow-auto rounded-sm bg-muted p-2 text-xs font-mono text-foreground">
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

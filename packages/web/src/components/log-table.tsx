import { format } from "date-fns";
import { ArrowUpDown, Check, Copy } from "lucide-react";
import { Fragment, useState } from "react";
import type { LogEntry } from "../lib/api";
import { getMethodBadgeVariant } from "../lib/badge-color";
import { useHandler } from "../lib/use-handler";
import { getLogKey } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";

interface LogTableProps {
  logs: LogEntry[];
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
}

export function LogTable({
  logs,
  selectedIds,
  onSelectionChange,
}: LogTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const handleRowClick = useHandler((log: LogEntry) => {
    const key = getLogKey(log);
    setExpandedKey((current) => (current === key ? null : key));
  });

  const handleSelectAll = useHandler((checked: boolean) => {
    if (checked) {
      const allIds = new Set(logs.map(getLogKey));
      onSelectionChange(allIds);
    } else {
      onSelectionChange(new Set());
    }
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
    logs.length > 0 && logs.every((log) => selectedIds.has(getLogKey(log)));

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
            <div className="flex items-center gap-1">
              Timestamp
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <div className="flex items-center gap-1">
              Server
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <div className="flex items-center gap-1">
              Session
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <div className="flex items-center gap-1">
              Method
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </th>
          <th className="text-left p-3 text-sm font-semibold text-foreground">
            <div className="flex items-center gap-1">
              Duration
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {logs.map((log) => {
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
                  <Badge variant={getMethodBadgeVariant(log.method)}>
                    {log.method}
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

  const copyToClipboard = useHandler(
    (data: unknown, type: "request" | "response") => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    },
  );

  return (
    <div className="flex gap-5">
      {log.request ? (
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
            {JSON.stringify(log.request, null, 2)}
          </pre>
        </div>
      ) : null}
      {log.response ? (
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
            {JSON.stringify(log.response, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

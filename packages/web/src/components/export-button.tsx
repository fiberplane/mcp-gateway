import { Download } from "lucide-react";
import type { LogEntry } from "../lib/api";
import { useHandler } from "../lib/use-handler";
import { Button } from "./ui/button";

interface ExportButtonProps {
  logs: LogEntry[];
  selectedIds: Set<string>;
  getLogKey: (log: LogEntry) => string;
}

export function ExportButton({
  logs,
  selectedIds,
  getLogKey,
}: ExportButtonProps) {
  const handleExport = useHandler(() => {
    // Determine which logs to export
    const logsToExport =
      selectedIds.size > 0
        ? logs.filter((log) => selectedIds.has(getLogKey(log)))
        : logs;

    if (logsToExport.length === 0) {
      return; // Nothing to export
    }

    // Convert to JSONL format (one JSON object per line)
    const jsonl = logsToExport.map((log) => JSON.stringify(log)).join("\n");

    // Create blob and trigger download
    const blob = new Blob([jsonl], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const count = logsToExport.length;
    a.download = `mcp-gateway-logs-${count}-${timestamp}.jsonl`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  const selectedCount = selectedIds.size;
  const buttonText = selectedCount > 0 ? `Export (${selectedCount})` : "Export";

  return (
    <Button type="button" onClick={handleExport} variant="default">
      <Download className="w-4 h-4 mr-2" />
      {buttonText}
    </Button>
  );
}

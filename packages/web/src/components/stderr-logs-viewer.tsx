import type { StdioServer } from "@fiberplane/mcp-gateway-types";
import { ChevronDown, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface StderrLogsViewerProps {
  server: StdioServer;
}

/**
 * Stderr Logs Viewer
 *
 * Collapsible section showing recent stderr output from stdio subprocess.
 * Displays last 20 lines with copy-to-clipboard functionality.
 */
export function StderrLogsViewer({ server }: StderrLogsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { processState } = server;
  const { stderrLogs = [] } = processState;

  // Auto-scroll to bottom when expanded
  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isExpanded]);

  // No logs to display
  if (stderrLogs.length === 0) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(stderrLogs.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      // Silently fail - copy button will show "Copy" again
    }
  };

  return (
    <div className="border border-border rounded-md mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 flex-1"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform text-muted-foreground",
              isExpanded && "rotate-180",
            )}
          />
          <span className="text-sm font-medium">
            Stderr Logs ({stderrLogs.length} lines)
          </span>
        </button>
        {isExpanded && (
          <Button
            onClick={handleCopy}
            size="sm"
            variant="ghost"
            className="flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy"}
          </Button>
        )}
      </div>

      {/* Log content */}
      {isExpanded && (
        <div className="border-t border-border p-3 bg-muted/30">
          <div className="bg-black/90 rounded p-3 overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="text-xs text-green-400 font-mono">
              {stderrLogs.map((line, i) => (
                <div key={`${i}-${line.slice(0, 20)}`}>{line}</div>
              ))}
              <div ref={logsEndRef} />
            </pre>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Showing last {stderrLogs.length} lines (maximum 100 stored in
            memory)
          </p>
        </div>
      )}
    </div>
  );
}

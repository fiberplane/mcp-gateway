import { Plus } from "lucide-react";
import { useServerModal } from "../contexts/ServerModalContext";
import { Button } from "./ui/button";

export function EmptyStateNoServers() {
  const { openAddServerModal } = useServerModal();
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center max-w-2xl mx-auto">
      {/* Heading */}
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        Welcome to MCP Gateway
      </h2>
      <p className="text-muted-foreground mb-6">
        Capture and monitor MCP traffic in real-time
      </p>

      {/* ASCII Architecture Diagram */}
      <div className="bg-muted border border-accent/20 rounded-lg p-6 mb-6 mx-auto w-fit">
        <div className="min-w-0 w-fit grid grid-cols-[1fr_auto_1fr_auto_1fr] items-baseline gap-x-2">
          <div className="text-xs font-mono text-muted-foreground overflow-x-auto text-center">
            Claude Code
            <br />
            (Client)
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center">
            →
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center">
            MCP Gateway
            <br />
            (Proxy)
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center">
            →
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center">
            MCP Server
            <br />
            (Your Server)
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center col-start-3">
            ↓<br />
            Logs captured
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        The gateway sits between your MCP client and servers,
        <br />
        capturing the mcp calls and responses for debugging.
      </p>

      {/* Primary CTA */}
      <Button size="lg" onClick={() => openAddServerModal()}>
        <Plus className="w-4 h-4 mr-2" />
        Add Your First Server
      </Button>
    </div>
  );
}

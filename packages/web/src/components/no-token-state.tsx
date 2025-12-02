import { Key } from "lucide-react";

/**
 * NoTokenState Component
 *
 * Displayed when user accesses /ui without a token in the URL.
 * Provides friendly guidance on how to get the correct URL from terminal output.
 */
export function NoTokenState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-muted rounded-full">
            <Key className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-4">
          Authentication Required
        </h1>

        <p className="text-lg text-muted-foreground mb-8">
          To access the MCP Gateway web interface, you need the authenticated
          URL from your terminal output.
        </p>

        <div className="bg-card border border-border rounded-lg p-6 text-left mb-6">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
            Check Your Terminal
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            When you started the gateway, your terminal displayed a Web UI URL
            with an authentication token:
          </p>
          <div className="bg-terminal-bg text-terminal-text rounded-md p-4 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">
            <div>mcp-gateway v0.5.1</div>
            <div className="mt-2">
              MCP Gateway server started at http://localhost:3333
            </div>
            <div className="text-emerald-400">
              Web UI: http://localhost:3333/ui?token=•••••••••••••••••••••••••
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Copy the full URL from your terminal (including the token parameter)
            and paste it into your browser's address bar.
          </p>
          <p className="text-xs mt-4">
            Tip: Set{" "}
            <code className="bg-muted px-1 rounded">MCP_GATEWAY_TOKEN</code> env
            var to use a custom token instead of auto-generated.
          </p>
        </div>
      </div>
    </div>
  );
}

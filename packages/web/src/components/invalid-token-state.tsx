import { AlertTriangle } from "lucide-react";

/**
 * InvalidTokenState Component
 *
 * Displayed when user has a token in the URL but it's invalid or expired.
 * Provides guidance on getting the correct URL from terminal.
 */
export function InvalidTokenState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-4">
          Invalid Authentication Token
        </h1>

        <p className="text-lg text-muted-foreground mb-8">
          The authentication token in your URL is invalid or has expired.
        </p>

        <div className="bg-card border border-border rounded-lg p-6 text-left mb-0 grid gap-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Get the Correct URL
          </h2>
          <p className="text-sm text-muted-foreground">
            Check your terminal output for the valid Web UI URL with
            authentication token:
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
          <p className="text-sm">
            Copy the full URL from your terminal (including the token parameter)
            and paste it into your browser's address bar.
          </p>
        </div>

        <div className="text-sm text-muted-foreground grid gap-1 mx-2 text-start">
          <div className="text-left grid gap-1">
            <p className="text-xs mt-4">
              <strong>Note:</strong> Tokens are unique per gateway session. If
              you restarted the gateway, you'll need to use the new URL from the
              terminal.
            </p>
            <p className="text-xs">
              <strong>Tip:</strong> Set{" "}
              <code className="bg-muted px-1 rounded font-mono text-foreground">
                MCP_GATEWAY_TOKEN
              </code>{" "}
              env var to use a custom token instead of auto-generated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

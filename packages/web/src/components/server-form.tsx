/**
 * Server Form Component
 *
 * Reusable form for adding or editing MCP server configurations
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { Copy, X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ServerFormProps {
  /**
   * Form mode: "add" or "edit"
   */
  mode: "add" | "edit";
  /**
   * Initial server configuration (for edit mode)
   */
  initialData?: McpServerConfig;
  /**
   * Callback when form is submitted
   */
  onSubmit: (config: McpServerConfig) => Promise<void>;
  /**
   * Callback when form is cancelled
   */
  onCancel: () => void;
  /**
   * Callback when delete is requested (edit mode only)
   */
  onDelete?: () => void;
  /**
   * Whether form is currently submitting
   */
  isSubmitting?: boolean;
}

export function ServerForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
}: ServerFormProps) {
  const nameId = useId();
  const urlId = useId();
  const [name, setName] = useState(initialData?.name ?? "");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [headers, setHeaders] = useState<Record<string, string>>(
    initialData?.headers ?? {},
  );
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { copy, copied } = useCopyToClipboard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!name.trim()) {
      setError("Server name is required");
      return;
    }

    if (!url.trim()) {
      setError("Server URL is required");
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError("Invalid URL format");
      return;
    }

    const config: McpServerConfig = {
      name: name.trim(),
      url: url.trim(),
      type: "http",
      headers,
    };

    try {
      await onSubmit(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save server");
    }
  };

  const handleAddHeader = () => {
    if (!headerKey.trim() || !headerValue.trim()) {
      return;
    }

    setHeaders((prev) => ({
      ...prev,
      [headerKey.trim()]: headerValue.trim(),
    }));
    setHeaderKey("");
    setHeaderValue("");
  };

  const handleRemoveHeader = useCallback((key: string) => {
    setHeaders((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Server Name */}
      <div>
        <label
          htmlFor={nameId}
          className="block text-sm font-medium text-foreground mb-2"
        >
          Server Name
        </label>
        <Input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-mcp-server"
          disabled={isSubmitting || mode === "edit"}
          required
          autoFocus={mode === "add"}
          autoComplete="off"
        />
        {mode === "edit" && (
          <p className="text-xs text-muted-foreground mt-1">
            Server name cannot be changed
          </p>
        )}
      </div>

      {/* Server URL */}
      <div>
        <label
          htmlFor={urlId}
          className="block text-sm font-medium text-foreground mb-2"
        >
          Server URL
        </label>
        <Input
          id={urlId}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3000"
          disabled={isSubmitting}
          required
          autoFocus={mode === "edit"}
          autoComplete="url"
        />
      </div>


      {/* Headers */}
      <div>
        <div className="block text-sm font-medium text-foreground mb-2">
          Custom Headers (Optional)
        </div>

        {/* Existing headers */}
        {Object.entries(headers).length > 0 && (
          <div className="space-y-2 mb-3">
            {Object.entries(headers).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 p-2 bg-muted rounded-md"
              >
                <span className="text-sm font-mono flex-1">
                  {key}: {value}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveHeader(key)}
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4" />
                  <span className="sr-only">Remove header {key}</span>
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new header */}
        <div className="flex gap-2">
          <Input
            type="text"
            value={headerKey}
            onChange={(e) => setHeaderKey(e.target.value)}
            placeholder="Header name"
            disabled={isSubmitting}
            className="flex-1"
            autoComplete="off"
          />
          <Input
            type="text"
            value={headerValue}
            onChange={(e) => setHeaderValue(e.target.value)}
            placeholder="Header value"
            disabled={isSubmitting}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddHeader}
            disabled={isSubmitting || !headerKey.trim() || !headerValue.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Gateway URL Preview */}
      <div className="mt-6 space-y-3">
        <div className="border p-2">
          <div className="text-sm font-semibold text-foreground">
            Gateway Proxy URL
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Use this URL in your MCP clients instead of the server URL
          </p>

          {/* Prominent URL display */}
          <div className="bg-accent/10 border-2 border-accent/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <code className="text-sm font-mono text-foreground flex-1 break-all">
                {window.location.origin}/s/
                <span
                  className={
                    name.trim()
                      ? "text-muted-foreground font-semibold"
                      : "text-muted-foreground italic"
                  }
                >
                  {name.trim() || "server-name"}
                </span>
                /mcp
              </code>
              {name.trim() && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copy(`${window.location.origin}/s/${name.trim()}/mcp`)
                  }
                  className="shrink-0"
                >
                  {copied ? "Copied!" : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
          {/* Show routing relationship when both name and URL are present */}
          {name.trim() && url.trim() && (
            <div className="mt-3 pt-3 border-t border-accent/20">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Routes to:</span>
                <code className="text-muted-foreground font-mono">
                  {url.trim()}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-between pt-2">
        {/* Delete button (edit mode only, left side) */}
        {mode === "edit" && onDelete ? (
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={isSubmitting}
            className="text-destructive hover:bg-destructive/10 border-destructive/20"
          >
            Delete Server
          </Button>
        ) : (
          <div />
        )}

        {/* Cancel and Submit buttons (right side) */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "add"
                ? "Adding..."
                : "Saving..."
              : mode === "add"
                ? "Add Server"
                : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Server Form Component
 *
 * Reusable form for adding or editing MCP server configurations
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { ChevronDown, Copy, X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ServerFormProps {
  /**
   * Form mode: "add" or "edit"
   */
  mode: "add" | "edit";
  /**
   * Initial server configuration (partial for add mode, full for edit mode)
   */
  initialData?: Partial<McpServerConfig>;
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
  const commandId = useId();
  const proxyUrlHeadingId = useId();
  const argsId = useId();
  const cwdId = useId();
  const timeoutId = useId();
  const sessionModeId = useId();
  const [name, setName] = useState(initialData?.name ?? "");
  const [serverType, setServerType] = useState<"http" | "stdio">(
    initialData?.type ?? "http",
  );

  // HTTP fields
  const [url, setUrl] = useState(
    initialData?.type === "http" ? (initialData.url ?? "") : "",
  );
  const [headers, setHeaders] = useState<Record<string, string>>(
    initialData?.type === "http" ? (initialData.headers ?? {}) : {},
  );
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");

  // Stdio fields
  const [command, setCommand] = useState(
    initialData?.type === "stdio" ? (initialData.command ?? "") : "",
  );
  const [args, setArgs] = useState(
    initialData?.type === "stdio" && initialData.args
      ? initialData.args
          .map((arg) => {
            // Quote args that contain spaces or special chars
            if (/[\s"'\\]/.test(arg)) {
              return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
            }
            return arg;
          })
          .join(" ")
      : "",
  );
  const [env, setEnv] = useState<Record<string, string>>(
    initialData?.type === "stdio" ? (initialData.env ?? {}) : {},
  );
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [cwd, setCwd] = useState(
    initialData?.type === "stdio" ? (initialData.cwd ?? "") : "",
  );
  const [timeout, setTimeout] = useState(
    initialData?.type === "stdio"
      ? (initialData.timeout?.toString() ?? "")
      : "",
  );
  const [sessionMode, setSessionMode] = useState<"shared" | "isolated">(
    initialData?.type === "stdio"
      ? (initialData.sessionMode ?? "shared")
      : "shared",
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { copy, copied } = useCopyToClipboard();

  // Validation helpers
  const validateUrl = useCallback((value: string): string | null => {
    if (!value.trim()) return "Server URL is required";
    try {
      new URL(value);
      return null;
    } catch {
      return "Invalid URL format (e.g., http://localhost:3000)";
    }
  }, []);

  const validateCommand = useCallback((value: string): string | null => {
    if (!value.trim()) return "Command is required";
    return null;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!name.trim()) {
      setError("Server name is required");
      return;
    }

    let config: McpServerConfig;

    if (serverType === "http") {
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

      config = {
        name: name.trim(),
        url: url.trim(),
        type: "http",
        headers,
      };
    } else {
      // Stdio validation
      if (!command.trim()) {
        setError("Command is required");
        return;
      }

      // Parse args with proper quote handling
      const parsedArgs: string[] = [];
      const argString = args.trim();
      if (argString) {
        let current = "";
        let inQuote: string | null = null;
        let i = 0;

        while (i < argString.length) {
          const char = argString[i];
          if (char === undefined) break; // Safety check

          if (inQuote) {
            // Inside quotes - collect until matching quote
            if (char === inQuote) {
              inQuote = null;
            } else if (char === "\\" && i + 1 < argString.length) {
              // Handle escape sequences
              const nextChar = argString[i + 1];
              if (nextChar !== undefined) {
                current += nextChar;
                i++;
              }
            } else {
              current += char;
            }
          } else {
            // Outside quotes
            if (char === '"' || char === "'") {
              inQuote = char;
            } else if (/\s/.test(char)) {
              // Whitespace - push current arg if non-empty
              if (current) {
                parsedArgs.push(current);
                current = "";
              }
            } else if (char === "\\" && i + 1 < argString.length) {
              // Handle escape sequences
              const nextChar = argString[i + 1];
              if (nextChar !== undefined) {
                current += nextChar;
                i++;
              }
            } else {
              current += char;
            }
          }
          i++;
        }

        // Push last arg if any
        if (current) {
          parsedArgs.push(current);
        }
      }

      config = {
        name: name.trim(),
        type: "stdio",
        command: command.trim(),
        args: parsedArgs,
        ...(Object.keys(env).length > 0 && { env }),
        ...(cwd.trim() && { cwd: cwd.trim() }),
        ...(timeout.trim() && { timeout: Number.parseInt(timeout.trim(), 10) }),
        sessionMode,
      };
    }

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

  const handleAddEnv = () => {
    if (!envKey.trim() || !envValue.trim()) {
      return;
    }

    setEnv((prev) => ({
      ...prev,
      [envKey.trim()]: envValue.trim(),
    }));
    setEnvKey("");
    setEnvValue("");
  };

  const handleRemoveEnv = useCallback((key: string) => {
    setEnv((prev) => {
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

      {/* Server Type */}
      {mode === "add" && (
        <fieldset>
          <legend
            id="server-type-legend"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Server Type
          </legend>
          <div
            className="flex gap-4"
            role="radiogroup"
            aria-labelledby="server-type-legend"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="serverType"
                value="http"
                checked={serverType === "http"}
                onChange={() => setServerType("http")}
                disabled={isSubmitting}
                className="w-4 h-4"
              />
              <span className="text-sm">HTTP</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="serverType"
                value="stdio"
                checked={serverType === "stdio"}
                onChange={() => setServerType("stdio")}
                disabled={isSubmitting}
                className="w-4 h-4"
              />
              <span className="text-sm">Stdio (subprocess)</span>
            </label>
          </div>
        </fieldset>
      )}

      {/* HTTP Server Fields */}
      {serverType === "http" && (
        <>
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
              onChange={(e) => {
                const newUrl = e.target.value;
                setUrl(newUrl);
                const errorMsg = validateUrl(newUrl);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  if (errorMsg) {
                    next.url = errorMsg;
                  } else {
                    delete next.url;
                  }
                  return next;
                });
              }}
              placeholder="http://localhost:3000"
              disabled={isSubmitting}
              required
              autoFocus={mode === "edit"}
              autoComplete="url"
              aria-invalid={!!fieldErrors.url}
              aria-describedby={fieldErrors.url ? `${urlId}-error` : undefined}
              className={cn(
                fieldErrors.url &&
                  "border-destructive focus-visible:ring-destructive",
              )}
            />
            {fieldErrors.url && (
              <p
                id={`${urlId}-error`}
                className="text-xs text-destructive mt-1"
                role="alert"
              >
                {fieldErrors.url}
              </p>
            )}
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
                disabled={
                  isSubmitting || !headerKey.trim() || !headerValue.trim()
                }
              >
                Add
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Stdio Server Fields */}
      {serverType === "stdio" && (
        <>
          {/* Command */}
          <div>
            <label
              htmlFor={commandId}
              className="block text-sm font-medium text-foreground mb-2"
            >
              Command
            </label>
            <Input
              id={commandId}
              type="text"
              value={command}
              onChange={(e) => {
                const newCommand = e.target.value;
                setCommand(newCommand);
                const errorMsg = validateCommand(newCommand);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  if (errorMsg) {
                    next.command = errorMsg;
                  } else {
                    delete next.command;
                  }
                  return next;
                });
              }}
              placeholder="npx"
              disabled={isSubmitting}
              required
              autoComplete="off"
              aria-invalid={!!fieldErrors.command}
              aria-describedby={
                fieldErrors.command ? `${commandId}-error` : undefined
              }
              className={cn(
                fieldErrors.command &&
                  "border-destructive focus-visible:ring-destructive",
              )}
            />
            {fieldErrors.command && (
              <p
                id={`${commandId}-error`}
                className="text-xs text-destructive mt-1"
                role="alert"
              >
                {fieldErrors.command}
              </p>
            )}
          </div>

          {/* Args */}
          <div>
            <label
              htmlFor={argsId}
              className="block text-sm font-medium text-foreground mb-2"
            >
              Arguments
            </label>
            <Input
              id={argsId}
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-memory"
              disabled={isSubmitting}
              autoComplete="off"
              aria-describedby={`${argsId}-hint`}
            />
            <p
              id={`${argsId}-hint`}
              className="text-xs text-muted-foreground mt-1"
            >
              Space-separated command arguments
            </p>
          </div>

          {/* Advanced Options Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-2 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">
                Advanced Options
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform text-muted-foreground",
                  showAdvanced && "rotate-180",
                )}
              />
            </button>
          </div>

          {/* Advanced Options Content */}
          {showAdvanced && (
            <>
              {/* Environment Variables */}
              <div>
                <div className="block text-sm font-medium text-foreground mb-2">
                  Environment Variables (Optional)
                </div>

                {/* Existing env vars */}
                {Object.entries(env).length > 0 && (
                  <div className="space-y-2 mb-3">
                    {Object.entries(env).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 p-2 bg-muted rounded-md"
                      >
                        <span className="text-sm font-mono flex-1">
                          {key}={value}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEnv(key)}
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4" />
                          <span className="sr-only">Remove env var {key}</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new env var */}
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={envKey}
                    onChange={(e) => setEnvKey(e.target.value)}
                    placeholder="Variable name"
                    disabled={isSubmitting}
                    className="flex-1"
                    autoComplete="off"
                  />
                  <Input
                    type="text"
                    value={envValue}
                    onChange={(e) => setEnvValue(e.target.value)}
                    placeholder="Value"
                    disabled={isSubmitting}
                    className="flex-1"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddEnv}
                    disabled={
                      isSubmitting || !envKey.trim() || !envValue.trim()
                    }
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Working Directory */}
              <div>
                <label
                  htmlFor={cwdId}
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Working Directory (Optional)
                </label>
                <Input
                  id={cwdId}
                  type="text"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="/path/to/working/directory"
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>

              {/* Timeout */}
              <div>
                <label
                  htmlFor={timeoutId}
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Timeout (Optional)
                </label>
                <Input
                  id={timeoutId}
                  type="number"
                  value={timeout}
                  onChange={(e) => setTimeout(e.target.value)}
                  placeholder="30000"
                  disabled={isSubmitting}
                  autoComplete="off"
                  aria-describedby={`${timeoutId}-hint`}
                />
                <p
                  id={`${timeoutId}-hint`}
                  className="text-xs text-muted-foreground mt-1"
                >
                  Request timeout in milliseconds
                </p>
              </div>

              {/* Session Mode */}
              <div>
                <label
                  htmlFor={sessionModeId}
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Session Mode
                </label>
                <select
                  id={sessionModeId}
                  value={sessionMode}
                  onChange={(e) =>
                    setSessionMode(
                      e.target.value === "isolated" ? "isolated" : "shared",
                    )
                  }
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-describedby={`${sessionModeId}-hint`}
                >
                  <option value="shared">Shared (Default)</option>
                  <option value="isolated">Isolated</option>
                </select>
                <p
                  id={`${sessionModeId}-hint`}
                  className="text-xs text-muted-foreground mt-1"
                >
                  Shared: Single subprocess for all sessions. Isolated: One
                  subprocess per session ID.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Gateway URL Preview - only for HTTP servers */}
      {serverType === "http" && (
        <section className="mt-6 space-y-3" aria-labelledby={proxyUrlHeadingId}>
          <div className="border p-2">
            <h3
              id={proxyUrlHeadingId}
              className="text-sm font-semibold text-foreground"
            >
              Gateway Proxy URL
            </h3>
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copy(`${window.location.origin}/s/${name.trim()}/mcp`)
                  }
                  className={cn("shrink-0", !name.trim() && "invisible")}
                  aria-hidden={!name.trim()}
                >
                  {copied ? "Copied!" : <Copy className="w-4 h-4" />}
                </Button>
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
        </section>
      )}

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

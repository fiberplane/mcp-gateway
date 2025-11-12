import type { ServerStatus } from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Plus } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useApi } from "../contexts/ApiContext";
import { useServerModal } from "../contexts/ServerModalContext";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { POLLING_INTERVALS } from "../lib/constants";
import { Button } from "./ui/button";
import { ErrorAlert } from "./ui/error-alert";
import { StatusDot } from "./ui/status-dot";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ServerTabsProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  panelId: string;
}

function getStatusVariant(
  status: ServerStatus,
  hasHistory?: boolean,
): "success" | "error" | "warning" | "neutral" {
  switch (status) {
    case "online":
      return "success";
    case "offline":
      // Differentiate: warning if it used to work, error if never worked
      return hasHistory ? "warning" : "error";
    case "not-found":
      return "neutral";
    default:
      return "neutral";
  }
}

function getTextColor(status: ServerStatus, isSelected: boolean): string {
  if (isSelected) {
    return "text-primary-foreground";
  }
  // Offline servers get destructive (red) text from design system
  if (status === "offline") {
    return "text-destructive";
  }
  return "text-foreground";
}

type ServerTabProps = {
  isSelected: boolean;
  panelId: string;
  onChange: (name: string) => void;
  title?: string;
  name: string;
  status: ServerStatus;
  url: string;
  lastHealthyTime?: number;
};

function ServerTab({
  isSelected,
  panelId,
  onChange,
  title,
  name,
  status,
  url,
  lastHealthyTime,
}: ServerTabProps) {
  const { copy, copied } = useCopyToClipboard();

  // Use URL from server info as title if no explicit title provided
  const originalUrl = title ?? url;
  const gatewayUrl = `${window.location.origin}/s/${name}/mcp`;

  const handleCopyTooltip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    copy(gatewayUrl);
  };

  const tabButton = (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onChange(name)}
      className={`
        flex items-center gap-2 h-8 px-3 py-1 rounded-md text-sm transition-colors cursor-pointer
        ${
          isSelected
            ? "bg-foreground text-background"
            : "bg-card text-foreground border border-border hover:bg-muted"
        }
      `}
    >
      <StatusDot
        variant={getStatusVariant(status, !!lastHealthyTime)}
        aria-label={status}
      />
      <span className={getTextColor(status, isSelected)}>{name}</span>
    </button>
  );

  // Only show tooltip if there's an original URL (server config available)
  if (!originalUrl) {
    return tabButton;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tabButton}</TooltipTrigger>
      <TooltipContent className="flex flex-col gap-3 text-sm cursor-pointer max-w-md">
        <div className="font-semibold text-foreground">
          Routing for "{name}"
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="grid">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 max-w-xs">
                Use this URL to connect your MCP client to the gateway
              </p>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded text-foreground font-mono block">
                  {gatewayUrl}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyTooltip}
                  className="w-7 h-7"
                >
                  {copied ? (
                    <Check size={12} className="text-muted-foreground" />
                  ) : (
                    <Copy size={12} className="text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ServerTabs({ value, onChange, panelId }: ServerTabsProps) {
  const api = useApi();
  const { openAddServerModal } = useServerModal();
  const { data, isLoading, error } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: POLLING_INTERVALS.SERVERS,
  });

  const tabListRef = useRef<HTMLDivElement>(null);

  const availableServers = useMemo(
    () => new Set(data?.servers.map((s) => s.name) ?? []),
    [data?.servers],
  );

  // Build the list of all tab values ("all" + server names)
  // Use useMemo to stabilize the array reference
  const allTabValues = useMemo(
    () => ["all", ...(data?.servers.map((s) => s.name) ?? [])],
    [data?.servers],
  );

  const selectedServer =
    value && !availableServers.has(value) ? "all" : value || "all";
  const selectedIndex = allTabValues.indexOf(selectedServer);

  const focusFallbackRef = useRef(false);

  useEffect(() => {
    if (!data?.servers || value === undefined) {
      return;
    }

    // If the current value is no longer available, reset to "all"
    if (!availableServers.has(value)) {
      focusFallbackRef.current = true;
      onChange(undefined);
    }
  }, [availableServers, data?.servers, onChange, value]);

  useEffect(() => {
    if (!focusFallbackRef.current || selectedServer !== "all") {
      return;
    }

    focusFallbackRef.current = false;
    requestAnimationFrame(() => {
      const buttons =
        tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[0]?.focus();
    });
  }, [selectedServer]);

  // Handle keyboard navigation
  // Using separate effect to ensure cleanup runs with correct tabList reference
  useEffect(() => {
    const tabList = tabListRef.current;
    if (!tabList) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let newIndex = selectedIndex;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          newIndex =
            selectedIndex > 0 ? selectedIndex - 1 : allTabValues.length - 1;
          break;
        case "ArrowRight":
          e.preventDefault();
          newIndex =
            selectedIndex < allTabValues.length - 1 ? selectedIndex + 1 : 0;
          break;
        case "Home":
          e.preventDefault();
          newIndex = 0;
          break;
        case "End":
          e.preventDefault();
          newIndex = allTabValues.length - 1;
          break;
        default:
          return;
      }

      const newValue = allTabValues[newIndex];
      onChange(newValue === "all" ? undefined : newValue);

      // Focus the newly selected tab
      requestAnimationFrame(() => {
        const buttons =
          tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[newIndex]?.focus();
      });
    };

    tabList.addEventListener("keydown", handleKeyDown);
    // Cleanup uses the captured tabList reference - ensures proper removal
    return () => {
      tabList.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex, allTabValues, onChange]);

  if (error) {
    return (
      <ErrorAlert
        error={error as Error}
        title="Failed to load servers"
        retry={() => window.location.reload()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="text-sm text-muted-foreground">Loading servers...</div>
    );
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Server filter tabs"
      className="flex gap-2 items-center flex-wrap"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedServer === "all"}
        aria-controls={panelId}
        tabIndex={selectedServer === "all" ? 0 : -1}
        onClick={() => onChange(undefined)}
        className={`
          flex items-center gap-2 h-8 px-3 py-1 rounded-md text-sm transition-colors cursor-pointer
          ${
            selectedServer === "all"
              ? "bg-foreground text-background"
              : "bg-card text-foreground border border-border hover:bg-muted"
          }
        `}
      >
        All servers
      </button>
      {data.servers.map((server) => {
        const isSelected = selectedServer === server.name;
        return (
          <ServerTab
            key={server.name}
            isSelected={isSelected}
            panelId={panelId}
            onChange={onChange}
            name={server.name}
            status={server.status}
            url={server.url}
            lastHealthyTime={server.lastHealthyTime}
          />
        );
      })}
      {data.servers.length === 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={openAddServerModal}
          className="h-8"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Server
        </Button>
      )}
    </div>
  );
}

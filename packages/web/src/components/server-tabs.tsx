import type { ServerStatus } from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useServerConfig } from "../hooks/use-server-configs";
import { api } from "../lib/api";
import { StatusDot } from "./ui/status-dot";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ServerTabsProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  panelId: string;
}

function getStatusVariant(
  status: ServerStatus,
): "success" | "error" | "neutral" {
  switch (status) {
    case "online":
      return "success";
    case "offline":
      return "error";
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
};

function ServerTab({
  isSelected,
  panelId,
  onChange,
  title,
  name,
  status,
}: ServerTabProps) {
  const serverConfig = useServerConfig(name);

  // Use server config URL as title if available, otherwise use provided title
  const displayTitle = title ?? serverConfig?.url;

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
      <StatusDot variant={getStatusVariant(status)} aria-label={status} />
      <span className={getTextColor(status, isSelected)}>
        {name}
        {status === "offline" && (
          <span className="text-xs ml-1">(offline)</span>
        )}
        {status === "not-found" && (
          <span className="text-xs ml-1">(not found)</span>
        )}
      </span>
    </button>
  );

  // Only show tooltip if there's a displayTitle (server URL)
  if (!displayTitle) {
    return tabButton;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tabButton}</TooltipTrigger>
      <TooltipContent>{displayTitle}</TooltipContent>
    </Tooltip>
  );
}

export function ServerTabs({ value, onChange, panelId }: ServerTabsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: 5000, // Refresh less often than logs
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
    return () => tabList.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, allTabValues, onChange]);

  if (error) {
    return (
      <div className="text-sm text-destructive">
        Failed to load servers. Please try refreshing the page.
      </div>
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
          />
        );
      })}
    </div>
  );
}

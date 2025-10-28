import type { ServerStatus } from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../lib/api";

interface ServerTabsProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  panelId: string;
}

function getStatusColor(status: ServerStatus): string {
  switch (status) {
    case "online":
      return "bg-status-success";
    case "offline":
      return "bg-status-error";
    case "not-found":
      return "bg-status-neutral";
    default:
      return "bg-status-neutral";
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

interface ServerTabProps {
  isSelected: boolean;
  panelId: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ServerTab({ isSelected, panelId, onClick, children }: ServerTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      onClick={onClick}
      className={`
        flex items-center gap-2 h-8 px-3 py-1 rounded-md text-sm transition-colors
        ${
          isSelected
            ? "bg-foreground text-background"
            : "bg-card text-foreground border border-border hover:bg-muted cursor-pointer"
        }
      `}
    >
      {children}
    </button>
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
      <ServerTab
        isSelected={selectedServer === "all"}
        panelId={panelId}
        onClick={() => onChange(undefined)}
      >
        All servers
      </ServerTab>
      {data.servers.map((server) => {
        const isSelected = selectedServer === server.name;
        return (
          <ServerTab
            key={server.name}
            isSelected={isSelected}
            panelId={panelId}
            onClick={() => onChange(server.name)}
          >
            <span
              className={`w-2 h-2 rounded-full ${getStatusColor(server.status)}`}
              aria-hidden="true"
            />
            <span className="sr-only">{server.status}</span>
            <span className={getTextColor(server.status, isSelected)}>
              {server.name}
              {server.logCount > 0 && ` (${server.logCount})`}
              {server.status === "offline" && (
                <span className="text-xs ml-1">(offline)</span>
              )}
              {server.status === "not-found" && (
                <span className="text-xs ml-1">(not found)</span>
              )}
            </span>
          </ServerTab>
        );
      })}
    </div>
  );
}

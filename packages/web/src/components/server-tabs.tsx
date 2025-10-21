import { useQuery } from "@tanstack/react-query";
import { api, type ServerStatus } from "../lib/api";

interface ServerTabsProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

function getStatusColor(status: ServerStatus): string {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    case "deleted":
      return "bg-gray-400";
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

export function ServerTabs({ value, onChange }: ServerTabsProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: 5000, // Refresh less often than logs
  });

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

  const selectedServer = value || "all";

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className={`
          h-8 px-3 py-1 rounded-md text-sm transition-colors
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
          <button
            key={server.name}
            type="button"
            onClick={() => onChange(server.name)}
            className={`
              flex items-center gap-2 h-8 px-3 py-1 rounded-md text-sm transition-colors
              ${
                isSelected
                  ? "bg-foreground text-background"
                  : "bg-card border border-border hover:bg-muted"
              }
            `}
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
              {server.status === "deleted" && (
                <span className="text-xs ml-1 opacity-70">(deleted)</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

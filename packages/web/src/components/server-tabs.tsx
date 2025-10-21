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
      return "bg-yellow-500";
    case "deleted":
      return "bg-gray-400";
  }
}

export function ServerTabs({ value, onChange }: ServerTabsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: 5000, // Refresh less often than logs
  });

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
          px-3 py-2 rounded-md text-sm font-medium transition-colors
          ${
            selectedServer === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-muted/80"
          }
        `}
      >
        All servers
      </button>
      {data.servers.map((server) => (
        <button
          key={server.name}
          type="button"
          onClick={() => onChange(server.name)}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
            ${
              selectedServer === server.name
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/80"
            }
          `}
        >
          <span
            className={`w-2 h-2 rounded-full ${getStatusColor(server.status)}`}
            title={`${server.status} status`}
          />
          <span>
            {server.name} ({server.logCount})
          </span>
        </button>
      ))}
    </div>
  );
}

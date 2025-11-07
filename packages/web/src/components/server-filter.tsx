import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { POLLING_INTERVALS } from "../lib/constants";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

interface ServerFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function ServerFilter({ value, onChange }: ServerFilterProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: POLLING_INTERVALS.SERVERS,
  });

  if (isLoading || !data) {
    return (
      <div className="text-sm text-muted-foreground">Loading servers...</div>
    );
  }

  return (
    <Tabs
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? undefined : v)}
    >
      <TabsList>
        <TabsTrigger value="all">All servers</TabsTrigger>
        {data.servers.map((server) => (
          <TabsTrigger key={server.name} value={server.name}>
            {server.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

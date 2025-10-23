import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

interface ClientFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function ClientFilter({ value, onChange }: ClientFilterProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.getClients(),
    refetchInterval: 5000, // Refresh less often than logs
  });

  if (isLoading || !data) {
    return (
      <div className="text-sm text-muted-foreground">Loading clients...</div>
    );
  }

  return (
    <Tabs
      value={value || "all"}
      onValueChange={(v) => onChange(v === "all" ? undefined : v)}
    >
      <TabsList>
        <TabsTrigger value="all">All clients</TabsTrigger>
        {data.clients.map((client) => (
          <TabsTrigger
            key={`${client.clientName}-${client.clientVersion}`}
            value={client.clientName}
          >
            {client.clientName} ({client.logCount})
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useApi } from "../contexts/ApiContext";
import { POLLING_INTERVALS } from "../lib/constants";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

interface ClientFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function ClientFilter({ value, onChange }: ClientFilterProps) {
  const api = useApi();
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.getClients(),
    refetchInterval: POLLING_INTERVALS.SERVERS,
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
            {client.clientName}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

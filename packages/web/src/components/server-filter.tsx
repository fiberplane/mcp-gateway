import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { api } from "../lib/api";
import { useHandler } from "../lib/use-handler";

interface ServerFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function ServerFilter({ value, onChange }: ServerFilterProps) {
  const id = useId();
  const { data, isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.getServers(),
    refetchInterval: 5000, // Refresh less often than logs
  });

  const handleChange = useHandler(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value;
      onChange(newValue || undefined);
    },
  );

  return (
    <div>
      <label htmlFor={id}>
        Server:{" "}
        <select
          id={id}
          value={value || ""}
          onChange={handleChange}
          disabled={isLoading}
        >
          <option value="">All servers</option>
          {data?.servers.map((server) => (
            <option key={server.name} value={server.name}>
              {server.name} ({server.logCount} logs)
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

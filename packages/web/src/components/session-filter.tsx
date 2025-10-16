import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { api } from "../lib/api";
import { useHandler } from "../lib/use-handler";

interface SessionFilterProps {
  serverName?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function SessionFilter({
  serverName,
  value,
  onChange,
}: SessionFilterProps) {
  const id = useId();
  const { data, isLoading } = useQuery({
    queryKey: ["sessions", serverName],
    queryFn: () => api.getSessions(serverName),
    refetchInterval: 5000, // Refresh less often than logs
  });

  const handleChange = useHandler(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value;
      onChange(newValue || undefined);
    },
  );

  // Group sessions by sessionId and sum up log counts
  const groupedSessions = data?.sessions.reduce(
    (acc, session) => {
      if (!acc[session.sessionId]) {
        acc[session.sessionId] = {
          sessionId: session.sessionId,
          logCount: 0,
          serverCount: 0,
        };
      }
      const entry = acc[session.sessionId];
      if (entry) {
        entry.logCount += session.logCount;
        entry.serverCount += 1;
      }
      return acc;
    },
    {} as Record<
      string,
      { sessionId: string; logCount: number; serverCount: number }
    >,
  );

  const uniqueSessions = groupedSessions ? Object.values(groupedSessions) : [];

  return (
    <div>
      <label htmlFor={id}>
        Session:{" "}
        <select
          id={id}
          value={value || ""}
          onChange={handleChange}
          disabled={isLoading}
        >
          <option value="">All sessions</option>
          {uniqueSessions.map((session) => (
            <option key={session.sessionId} value={session.sessionId}>
              {session.sessionId.slice(0, 8)}... ({session.logCount} logs
              {!serverName && session.serverCount > 1
                ? ` across ${session.serverCount} servers`
                : ""}
              )
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

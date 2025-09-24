import type { FC } from "hono/jsx";

export type EventKind = "request" | "response" | "notification" | "ping";
export type EventDirection = "outbound" | "inbound";

export interface MockEvent {
  timestamp: number;
  kind: EventKind;
  direction: EventDirection;
  id?: number | string;
  method?: string;
  serverName?: string;
  status?: "ok" | "error" | "info";
  summary?: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function directionGlyph(direction: EventDirection, kind: EventKind): string {
  if (kind === "notification") return "•";
  return direction === "outbound" ? "⇢" : "⇠";
}

export const RecentEventsTable: FC<{ events: MockEvent[] }> = ({ events }) => {
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th class="width-min">Time</th>
            <th class="width-min">Dir</th>
            <th class="width-min">Type</th>
            <th class="width-auto">Method / Summary</th>
            <th class="width-min">ID</th>
            <th class="width-min">Server</th>
            <th class="width-min">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={`${e.timestamp}-${e.kind}-${e.direction}-${e.id ?? "noid"}-${e.method ?? e.summary ?? ""}-${e.serverName ?? "anon"}`}
            >
              <td>{formatTime(e.timestamp)}</td>
              <td>{directionGlyph(e.direction, e.kind)}</td>
              <td>{e.kind}</td>
              <td>{e.method ? e.method : e.summary}</td>
              <td>{e.id ?? "—"}</td>
              <td>{e.serverName ?? "—"}</td>
              <td>{e.status ?? "info"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function randomChoice<T>(arr: T[]): T {
  // @ts-expect-error TODO:fix
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMockEvents(
  count: number,
  serverNames: string[] = [],
): MockEvent[] {
  const now = Date.now();
  const methodsRequest = [
    "tools/list",
    "tools/call",
    "resources/list",
    "resources/read",
    "prompts/list",
    "prompts/get",
    "sampling/createMessage",
  ];
  const notifications = [
    "notifications/message",
    "notifications/progress",
    "notifications/log",
  ];

  const events: MockEvent[] = [];
  for (let i = 0; i < count; i++) {
    const kind = randomChoice<EventKind>([
      "request",
      "response",
      "notification",
      "ping",
    ]);
    const direction = randomChoice<EventDirection>(["outbound", "inbound"]);
    const ts = now - randomInt(0, 30 * 60 * 1000);
    const serverName =
      serverNames.length > 0 ? randomChoice(serverNames) : undefined;

    if (kind === "request") {
      const id = randomInt(1000, 9999);
      events.push({
        timestamp: ts,
        kind,
        direction,
        id,
        method: randomChoice(methodsRequest),
        serverName,
        status: "info",
      });
      continue;
    }

    if (kind === "response") {
      const ok = Math.random() < 0.9;
      events.push({
        timestamp: ts,
        kind,
        direction,
        id: randomInt(1000, 9999),
        summary: ok ? "200 OK" : "RPC Error",
        serverName,
        status: ok ? "ok" : "error",
      });
      continue;
    }

    if (kind === "notification") {
      events.push({
        timestamp: ts,
        kind,
        direction,
        method: randomChoice(notifications),
        summary: "event",
        serverName,
        status: "info",
      });
      continue;
    }

    events.push({
      timestamp: ts,
      kind: "ping",
      direction,
      summary: "ping",
      serverName,
      status: "ok",
    });
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

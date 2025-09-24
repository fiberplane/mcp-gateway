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
  detail?: EventDetail;
}

// Simplified MCP-like content items
type McpTextContent = { type: "text"; text: string };
type McpResourceContent = {
  type: "resource";
  uri: string;
  mimeType?: string;
  text?: string;
};
type McpImageContent = { type: "image"; uri: string };
type McpContent = McpTextContent | McpResourceContent | McpImageContent;

// Abstract event detail union to support multiple row types
type EventDetail =
  | {
      type: "tool-call-request";
      name: string;
      arguments: Record<string, unknown>;
    }
  | {
      type: "tool-call-result";
      name: string;
      content: McpContent[];
    }
  | {
      type: "resources-list";
      resources: {
        uri: string;
        name?: string;
        description?: string;
        mimeType?: string;
      }[];
    }
  | {
      type: "resources-read";
      resource: { uri: string; name?: string; mimeType?: string };
      content: McpContent[];
    }
  | {
    type: "prompts-list";
    prompts: {
      name: string;
      description?: string;
      arguments?: { name: string; description?: string; required?: boolean }[];
    }[];
  }
  | {
      type: "prompts-get";
      prompt: { name: string; arguments: Record<string, unknown> };
      messages: { role: "system" | "user" | "assistant"; content: McpContent[] }[];
    }
  | {
      type: "notification";
      level: "info" | "warn" | "error";
      message: string;
    }
  | { type: "ping" };

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
            <th class="width-min">Details</th>
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
              <td>
                {e.detail ? (
                  <details>
                    <summary>Expand</summary>
                    {renderDetail(e.detail)}
                  </details>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function renderDetail(detail: EventDetail) {
  switch (detail.type) {
    case "tool-call-request":
      return (
        <div>
          <strong>Tool:</strong> <code>{detail.name}</code>
          <div>
            <strong>Parameters</strong>
            <pre>{JSON.stringify(detail.arguments, null, 2)}</pre>
          </div>
        </div>
      );
    case "tool-call-result":
      return (
        <div>
          <strong>Tool:</strong> <code>{detail.name}</code>
          <div>
            <strong>Result</strong>
            {renderContent(detail.content)}
          </div>
        </div>
      );
    case "resources-list":
      return (
        <div>
          <strong>Resources</strong>
          <ul>
            {detail.resources.map((r) => (
              <li>
                <code>{r.uri}</code>
                {r.name ? <span> — {r.name}</span> : null}
                {r.mimeType ? (
                  <span>
                    {" "}
                    <em>({r.mimeType})</em>
                  </span>
                ) : null}
                {r.description ? <div>{r.description}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      );
    case "resources-read":
      return (
        <div>
          <strong>Resource:</strong> <code>{detail.resource.uri}</code>
          {detail.resource.mimeType ? (
            <span>
              {" "}
              <em>({detail.resource.mimeType})</em>
            </span>
          ) : null}
          <div>{renderContent(detail.content)}</div>
        </div>
      );
    case "prompts-list":
      return (
        <div>
          <strong>Prompts</strong>
          <ul>
            {detail.prompts.map((p) => (
              <li>
                <code>{p.name}</code>
                {p.description ? <span> — {p.description}</span> : null}
                {p.arguments && p.arguments.length > 0 ? (
                  <div>
                    <em>Arguments:</em>
                    <ul>
                      {p.arguments.map((a) => (
                        <li>
                          <code>{a.name}</code>
                          {a.required ? <strong> *</strong> : null}
                          {a.description ? <span> — {a.description}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      );
    case "prompts-get":
      return (
        <div>
          <strong>Prompt:</strong> <code>{detail.prompt.name}</code>
          <div>
            <strong>Parameters</strong>
            <pre>{JSON.stringify(detail.prompt.arguments, null, 2)}</pre>
          </div>
          <div>
            <strong>Messages</strong>
            <ul>
              {detail.messages.map((m, idx) => (
                <li>
                  <em>{m.role}</em>
                  {renderContent(m.content)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "notification":
      return (
        <div>
          <strong>{detail.level.toUpperCase()}</strong>
          <div>{detail.message}</div>
        </div>
      );
    case "ping":
      return <div>Ping</div>;
    default:
      return <pre>{JSON.stringify(detail as unknown, null, 2)}</pre>;
  }
}

function renderContent(content: McpContent[] | McpContent) {
  const items = Array.isArray(content) ? content : [content];
  return (
    <div>
      {items.map((c) => {
        if (c.type === "text") {
          return <pre>{(c as McpTextContent).text}</pre>;
        }
        if (c.type === "resource") {
          const r = c as McpResourceContent;
          return (
            <div>
              <div>
                <strong>Resource</strong> <code>{r.uri}</code>
                {r.mimeType ? (
                  <span>
                    {" "}
                    <em>({r.mimeType})</em>
                  </span>
                ) : null}
              </div>
              {r.text ? <pre>{r.text}</pre> : null}
            </div>
          );
        }
        if (c.type === "image") {
          const i = c as McpImageContent;
          return (
            <div>
              <strong>Image</strong> <code>{i.uri}</code>
            </div>
          );
        }
        return <pre>{JSON.stringify(c, null, 2)}</pre>;
      })}
    </div>
  );
}

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
      const method = randomChoice(methodsRequest);
      events.push({
        timestamp: ts,
        kind,
        direction,
        id,
        method,
        serverName,
        status: "info",
        detail: generateDetailForRequest(method),
      });
      continue;
    }

    if (kind === "response") {
      const ok = Math.random() < 0.9;
      const method = randomChoice(methodsRequest);
      events.push({
        timestamp: ts,
        kind,
        direction,
        id: randomInt(1000, 9999),
        method,
        summary: ok ? "200 OK" : "RPC Error",
        serverName,
        status: ok ? "ok" : "error",
        detail: ok ? generateDetailForResponse(method) : undefined,
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
        detail: {
          type: "notification",
          level: "info",
          message: "Background task updated",
        },
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

function generateDetailForRequest(method: string): EventDetail | undefined {
  if (method === "tools/call") {
    const tool = randomChoice(["search", "read_file", "write_file", "list_dir", "http_get"]);
    const args: Record<string, unknown> =
      tool === "search"
        ? { query: randomChoice(["mcp spec", "typescript examples", "server health"]) }
        : tool === "read_file"
          ? { path: randomChoice(["/etc/hosts", "/workspace/README.md"]) }
          : tool === "write_file"
            ? { path: "/tmp/note.txt", content: "hello from mcp" }
            : tool === "list_dir"
              ? { path: randomChoice(["/workspace", "/tmp"]) }
              : { url: "https://example.com" };
    return { type: "tool-call-request", name: tool, arguments: args };
  }
  if (method === "resources/list") {
    return {
      type: "resources-list",
      resources: [
        {
          uri: "file:///workspace/README.md",
          name: "Workspace README",
          description: "Project overview",
          mimeType: "text/markdown",
        },
        {
          uri: "file:///workspace/src/server.ts",
          name: "Server",
          mimeType: "text/typescript",
        },
      ],
    };
  }
  if (method === "resources/read") {
    return {
      type: "resources-read",
      resource: { uri: "file:///workspace/README.md", mimeType: "text/markdown" },
      content: [{ type: "text", text: "# Project\nThis is a demo." }],
    };
  }
  if (method === "prompts/list") {
    return {
      type: "prompts-list",
      prompts: [
        {
          name: "summarize",
          description: "Summarize provided text",
          arguments: [{ name: "text", description: "Text to summarize", required: true }],
        },
        { name: "fix_code", description: "Suggest code fixes" },
      ],
    };
  }
  if (method === "prompts/get") {
    return {
      type: "prompts-get",
      prompt: { name: "summarize", arguments: { text: "Long passage..." } },
      messages: [
        { role: "system", content: [{ type: "text", text: "You are a helpful assistant." }] },
        { role: "user", content: [{ type: "text", text: "Summarize the following text." }] },
      ],
    };
  }
  return undefined;
}

function generateDetailForResponse(method: string): EventDetail | undefined {
  if (method === "tools/call") {
    const tool = randomChoice(["search", "read_file", "write_file", "list_dir", "http_get"]);
    const content: McpContent[] =
      tool === "search"
        ? [{ type: "text", text: "Found 3 results for your query." }]
        : tool === "read_file"
          ? [{ type: "resource", uri: "file:///etc/hosts", mimeType: "text/plain", text: "127.0.0.1 localhost" }]
          : tool === "write_file"
            ? [{ type: "text", text: "Wrote 12 bytes to /tmp/note.txt" }]
            : tool === "list_dir"
              ? [{ type: "text", text: "README.md\nsrc/\npackage.json" }]
              : [{ type: "text", text: "HTTP 200 OK" }];
    return { type: "tool-call-result", name: tool, content };
  }
  if (method === "resources/read") {
    return {
      type: "resources-read",
      resource: { uri: "file:///workspace/README.md", mimeType: "text/markdown" },
      content: [{ type: "text", text: "# Project\nThis is a demo." }],
    };
  }
  if (method === "resources/list") {
    return generateDetailForRequest(method);
  }
  if (method === "prompts/get") {
    return {
      type: "prompts-get",
      prompt: { name: "summarize", arguments: { text: "Long passage..." } },
      messages: [
        { role: "system", content: [{ type: "text", text: "You are a helpful assistant." }] },
        { role: "assistant", content: [{ type: "text", text: "Here is the summary..." }] },
      ],
    };
  }
  if (method === "prompts/list") {
    return generateDetailForRequest(method);
  }
  return undefined;
}

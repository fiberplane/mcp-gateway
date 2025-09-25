import type { FC } from "hono/jsx";
import type { McpServer } from "../../registry.js";
import { ToolCallStories } from "../components/events/ToolCall.js";
import { Navigation } from "../components/Navigation.js";
import { UIEventsTable } from "../components/UIEventsTable.js";
import { Layout } from "../Layout.js";
import type { UIEvent } from "../types/events.js";

interface ServerDetailsPageProps {
  server: McpServer;
}

export const ServerDetailsPage: FC<ServerDetailsPageProps> = ({ server }) => {
  return (
    <Layout>
      <h1>Server: {server.name}</h1>

      {/* Section anchors (no JS) */}
      <nav style="margin-bottom: 1rem;">
        <a href="#details">Details</a>
        <span> | </span>
        <a href="#events">Events</a>
      </nav>
      <hr />

      <div id="details">
        <h2>Basic Information</h2>
        <table>
          <tbody>
            <tr>
              <th class="width-min">Name</th>
              <td>{server.name}</td>
            </tr>
            <tr>
              <th class="width-min">URL</th>
              <td>
                <code>{server.url}</code>
                <span> </span>
                <a href={server.url} target="_blank" rel="noopener noreferrer">
                  ↗ Open
                </a>
              </td>
            </tr>
            <tr>
              <th class="width-min">Type</th>
              <td>{server.type}</td>
            </tr>
            <tr>
              <th class="width-min">Exchange Count</th>
              <td>{server.exchangeCount}</td>
            </tr>
            <tr>
              <th class="width-min">Last Activity</th>
              <td>
                {server.lastActivity
                  ? new Date(server.lastActivity).toLocaleString()
                  : "Never"}
              </td>
            </tr>
          </tbody>
        </table>

        <h2>Headers</h2>
        {Object.keys(server.headers).length === 0 ? (
          <p>No custom headers configured.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th class="width-min">Header Name</th>
                <th class="width-auto">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(server.headers).map(([key, value]) => (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>
                    <code>{value}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <hr />

      <div id="events">
        <h2>Recent Events</h2>
        <p>Latest MCP protocol exchanges for this server</p>
        <UIEventsTable
          events={[
            {
              id: "tool-server-1",
              timestamp: ToolCallStories.successful.timestamp,
              type: "tool_call",
              method: "tools/call",
              requestId: ToolCallStories.successful.requestId,
              status: "success",
              metadata: {
                serverName: server.name,
                sessionId: ToolCallStories.successful.sessionId || "session-1",
                durationMs: ToolCallStories.successful.durationMs || 100,
                httpStatus: 200,
              },
              summary: `Tool call: ${ToolCallStories.successful.toolName}`,
              details: {
                type: "tool_call",
                toolName: ToolCallStories.successful.toolName,
                arguments: ToolCallStories.successful.requestParams,
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(
                        ToolCallStories.successful.response?.result,
                      ),
                    },
                  ],
                  isError: false,
                },
              },
            } as UIEvent,
          ]}
        />
        <p>
          <a href="/ui/events">View All Events</a>
        </p>
      </div>

      <hr />

      <div id="actions">
        <h2>Actions</h2>
        <div class="grid">
          <button type="button" onclick="window.location.href='/ui/servers'">
            ← Back to Servers
          </button>
          <button
            type="button"
            onclick={`window.open('${server.url}', '_blank')`}
          >
            Open Server URL
          </button>
        </div>
      </div>

      <hr />

      <Navigation />
    </Layout>
  );
};

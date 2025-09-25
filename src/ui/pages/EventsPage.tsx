import { raw } from "hono/html";
import type { FC } from "hono/jsx";
import type { Registry } from "../../registry.js";
import { PromptGetStories } from "../components/events/PromptGet.js";
import { ResourceReadStories } from "../components/events/ResourceRead.js";
import { ToolCallStories } from "../components/events/ToolCall.js";
import { Navigation } from "../components/Navigation.js";
import { UIEventsTable } from "../components/UIEventsTable.js";
import { Layout } from "../Layout.js";
import type { UIEvent } from "../types/events.js";

interface EventsPageProps {
  registry: Registry;
  storageDir?: string;
}

export const EventsPage: FC<EventsPageProps> = ({ registry }) => {
  const serverNames = registry.servers.map((s) => s.name);

  // Create mock events based on our event component stories
  const mockEvents: UIEvent[] = [
    {
      id: "tool-1",
      timestamp: ToolCallStories.successful.timestamp,
      type: "tool_call",
      method: "tools/call",
      requestId: ToolCallStories.successful.requestId,
      status: "success",
      metadata: {
        serverName: serverNames[0] || "demo-server",
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
              text: JSON.stringify(ToolCallStories.successful.response?.result),
            },
          ],
          isError: false,
        },
      },
    },
    {
      id: "prompt-1",
      timestamp: PromptGetStories.successful.timestamp,
      type: "prompt_get",
      method: "prompts/get",
      requestId: PromptGetStories.successful.requestId,
      status: "success",
      metadata: {
        serverName: serverNames[1] || "demo-server",
        sessionId: PromptGetStories.successful.sessionId || "session-2",
        durationMs: PromptGetStories.successful.durationMs || 150,
        httpStatus: 200,
      },
      summary: `Prompt: ${PromptGetStories.successful.promptName}`,
      details: {
        type: "prompt_get",
        prompt: {
          name: PromptGetStories.successful.promptName,
          arguments: PromptGetStories.successful.requestParams.arguments || {},
        },
        messages:
          PromptGetStories.successful.response?.result?.messages.map((msg) => ({
            role: msg.role,
            content: [
              {
                type: msg.content.type === "audio" ? "text" : msg.content.type, // Map audio to text for UI compatibility
                text: msg.content.text,
                uri: msg.content.resource?.uri,
                mimeType: msg.content.mimeType,
              },
            ],
          })) || [],
      },
    },
    {
      id: "resource-1",
      timestamp: ResourceReadStories.textFile.timestamp,
      type: "resource_read",
      method: "resources/read",
      requestId: ResourceReadStories.textFile.requestId,
      status: "success",
      metadata: {
        serverName: serverNames[0] || "demo-server",
        sessionId: ResourceReadStories.textFile.sessionId || "session-3",
        durationMs: ResourceReadStories.textFile.durationMs || 45,
        httpStatus: 200,
      },
      summary: `Resource: ${ResourceReadStories.textFile.uri}`,
      details: {
        type: "resource_read",
        resource: {
          uri: ResourceReadStories.textFile.uri,
          name: ResourceReadStories.textFile.response?.result?.contents[0]
            ?.name,
          mimeType:
            ResourceReadStories.textFile.response?.result?.contents[0]
              ?.mimeType,
        },
        content: [
          {
            type: "text",
            text:
              ResourceReadStories.textFile.response?.result?.contents[0]
                ?.text || "",
          },
        ],
      },
    },
  ];

  const allEvents = mockEvents;
  const allEventsJson = JSON.stringify(allEvents);

  // Calculate some stats
  const totalEvents = allEvents.length;
  const errorEvents = allEvents.filter((e) => e.status === "error").length;
  const recentEvents = allEvents.filter((e) => {
    const eventTime = new Date(e.timestamp);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return eventTime > oneHourAgo;
  }).length;

  return (
    <Layout>
      <h1>Recent Events</h1>
      <p>
        MCP JSON-RPC exchanges with enhanced visualization and filtering
        capabilities.
      </p>

      <table>
        <thead>
          <tr>
            <th class="width-min">Total Events</th>
            <th class="width-min">Successful</th>
            <th class="width-min">Errors</th>
            <th class="width-min">Last Hour</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{totalEvents}</td>
            <td>{totalEvents - errorEvents}</td>
            <td>{errorEvents}</td>
            <td>{recentEvents}</td>
          </tr>
        </tbody>
      </table>

      <hr />

      <form class="grid">
        <label for="search">
          Search by method/tool/resource name:
          <input
            type="text"
            id="search"
            placeholder="e.g. tools/call, read_file, prompts/get"
            oninput="filterEvents()"
          />
        </label>
        <label for="statusFilter">
          Status:
          <select id="statusFilter" onchange="filterEvents()">
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="error">Errors</option>
            <option value="info">Info</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label for="typeFilter">
          Event Type:
          <select id="typeFilter" onchange="filterEvents()">
            <option value="">All Types</option>
            <option value="initialize">Initialize</option>
            <option value="tool_call">Tool Calls</option>
            <option value="resource_list">Resources</option>
            <option value="prompt_list">Prompts</option>
            <option value="notification">Notifications</option>
          </select>
        </label>
      </form>

      <nav style="display: flex; justify-content: space-between;">
        <button type="button" onclick="clearFilters()">
          Clear Filters
        </button>
        <a href="/ui/events">Refresh</a>
      </nav>

      <div id="events-container">
        <UIEventsTable events={allEvents} compact={false} />
      </div>

      {raw(`<script id="allEvents">${allEventsJson}</script>`)}

      {raw(`
        <script>
          (function(){
            var allEvents = [];
            var node = document.getElementById('allEvents');
            if (node && node.textContent) {
              try { allEvents = JSON.parse(node.textContent); } catch(e) {}
            }

            function formatTime(timestamp, compact) {
              var date = new Date(timestamp);
              if (compact !== false) {
                var now = new Date();
                var isToday = date.toDateString() === now.toDateString();
                if (isToday) {
                  return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                } else {
                  return date.toLocaleDateString([], {month: 'short', day: 'numeric'});
                }
              }
              return date.toLocaleString();
            }

            function getStatusColor(status) {
              switch (status) {
                case 'success': return '#059669';
                case 'error': return '#dc2626';
                case 'pending': return '#d97706';
                case 'info':
                default: return '#6b7280';
              }
            }

            function getEventTypeIcon(type) {
              switch (type) {
                case 'initialize': return '🚀';
                case 'ping': return '📡';
                case 'tool_list': return '🔧';
                case 'tool_call': return '⚡';
                case 'resource_list': return '📁';
                case 'resource_read': return '📄';
                case 'prompt_list': return '💭';
                case 'prompt_get': return '🎯';
                case 'notification': return '📢';
                case 'completion': return '✅';
                case 'elicitation': return '❓';
                default: return '🔹';
              }
            }

            window.filterEvents = function(){
              var term = (document.getElementById('search').value || '').toLowerCase();
              var status = document.getElementById('statusFilter').value;
              var type = document.getElementById('typeFilter').value;
              var list = allEvents.slice();

              if (term) {
                list = list.filter(function(e){
                  var m = (e.method||'').toLowerCase();
                  var s = (e.summary||'').toLowerCase();
                  var server = (e.metadata.serverName||'').toLowerCase();
                  return m.indexOf(term) !== -1 || s.indexOf(term) !== -1 || server.indexOf(term) !== -1;
                });
              }

              if (status) {
                list = list.filter(function(e){ return e.status === status; });
              }

              if (type) {
                list = list.filter(function(e){ return e.type === type; });
              }

              updateTable(list);
            };

            window.clearFilters = function(){
              document.getElementById('search').value = '';
              document.getElementById('statusFilter').value = '';
              document.getElementById('typeFilter').value = '';
              updateTable(allEvents);
            };

            function updateTable(events){
              var rows = events.map(function(e){
                var icon = getEventTypeIcon(e.type);

                return '<tr>'
                  + '<td title="' + new Date(e.timestamp).toLocaleString() + '">' + formatTime(e.timestamp, true) + '</td>'
                  + '<td><span title="' + e.type + '">' + icon + '</span> '
                  + (e.details ? ('<details><summary>' + e.summary + '</summary></details>') : e.summary)
                  + '</td>'
                  + '<td>' + (e.requestId || '—') + '</td>'
                  + '<td>' + (e.metadata.serverName || '—') + '</td>'
                  + '<td>' + e.metadata.durationMs + 'ms</td>'
                  + '<td>' + e.status + '</td>'
                  + '</tr>';
              }).join('');

              var html = ''
                + '<p>Showing ' + events.length + ' of ' + allEvents.length + ' events</p>'
                + '<table><thead><tr>'
                + '<th class="width-min">Time</th>'
                + '<th class="width-auto">Event</th>'
                + '<th class="width-min">ID</th>'
                + '<th class="width-min">Server</th>'
                + '<th class="width-min">Duration</th>'
                + '<th class="width-min">Status</th>'
                + '</tr></thead><tbody>' + rows + '</tbody></table>';

              var container = document.getElementById('events-container');
              if (container) container.innerHTML = html;
            }

            // Handle details toggle for event expansion (if details are shown)
            document.addEventListener('click', function(e) {
              if (e.target.tagName === 'SUMMARY') {
                var details = e.target.parentElement;
                setTimeout(function() {
                  var row = details.closest('tr');
                  var detailRow = row.nextElementSibling;
                  if (detailRow && detailRow.classList.contains('event-detail')) {
                    detailRow.style.display = details.open ? 'table-row' : 'none';
                  }
                }, 0);
              }
            });
          })();
        </script>
      `)}

      <hr />
      <Navigation />
    </Layout>
  );
};

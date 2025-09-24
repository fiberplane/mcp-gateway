import { raw } from "hono/html";
import type { FC } from "hono/jsx";
import type { Registry } from "../../registry.js";
import { Navigation } from "../components/Navigation.js";
import {
  generateMockEvents,
  RecentEventsTable,
} from "../components/RecentEventsTable.js";
import { Layout } from "../Layout.js";

interface EventsPageProps {
  registry: Registry;
}

export const EventsPage: FC<EventsPageProps> = ({ registry }) => {
  const serverNames = registry.servers.map((s) => s.name);
  const allEvents = generateMockEvents(100, serverNames); // Generate more events for search
  const allEventsJson = JSON.stringify(allEvents);
  return (
    <Layout>
      <h1>Recent Events</h1>
      <p>MCP JSON-RPC exchanges with search and filtering capabilities.</p>

      <div style="margin-bottom: calc(var(--line-height) * 2);">
        <div class="grid">
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
              <option value="ok">Success</option>
              <option value="error">Errors</option>
              <option value="info">Info</option>
            </select>
          </label>
        </div>
        <div class="grid" style="margin-top: var(--line-height);">
          <button type="button" onclick="clearFilters()">
            Clear Filters
          </button>
          <a href="/ui/events">Refresh</a>
        </div>
      </div>

      <div id="events-container">
        <RecentEventsTable events={allEvents} compact={false} />
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
            function compact(ts){
              var d = new Date(ts), n = new Date();
              return d.toDateString() === n.toDateString()
                ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                : d.toLocaleDateString([], {month:'short', day:'numeric'});
            }
            window.filterEvents = function(){
              var term = (document.getElementById('search').value || '').toLowerCase();
              var status = document.getElementById('statusFilter').value;
              var list = allEvents.slice();
              if (term) {
                list = list.filter(function(e){
                  var m = (e.method||'').toLowerCase();
                  var s = (e.summary||'').toLowerCase();
                  return m.indexOf(term) !== -1 || s.indexOf(term) !== -1;
                });
              }
              if (status) list = list.filter(function(e){ return e.status === status; });
              updateTable(list);
            };
            window.clearFilters = function(){
              document.getElementById('search').value = '';
              document.getElementById('statusFilter').value = '';
              updateTable(allEvents);
            };
            function updateTable(events){
              var rows = events.map(function(e){
                return '<tr>'
                  + '<td style="opacity:0.7;" title="' + new Date(e.timestamp).toLocaleString() + '">' + compact(e.timestamp) + '</td>'
                  + '<td>' + (e.detail ? ('<details><summary>' + (e.method||e.summary) + '</summary></details>') : (e.method||e.summary)) + '</td>'
                  + '<td>' + (e.id || '—') + '</td>'
                  + '<td>' + (e.serverName || '—') + '</td>'
                  + '<td><span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:0.75em;font-weight:bold;color:white;background-color:'
                  + (e.status === 'error' ? '#dc2626' : (e.status === 'ok' ? '#059669' : '#6b7280'))
                  + ';">' + (e.status || 'info') + '</span></td>'
                  + '</tr>';
              }).join('');
              var html = ''
                + '<p>Showing ' + events.length + ' of ' + allEvents.length + ' events</p>'
                + '<div style="overflow-x:auto;">'
                + '<table><thead><tr>'
                + '<th class="width-min">Time</th>'
                + '<th class="width-auto">Method / Summary</th>'
                + '<th class="width-min">ID</th>'
                + '<th class="width-min">Server</th>'
                + '<th class="width-min">Status</th>'
                + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
              var container = document.getElementById('events-container');
              if (container) container.innerHTML = html;
            }
          })();
        </script>
      `)}

      <hr />
      <Navigation />
    </Layout>
  );
};

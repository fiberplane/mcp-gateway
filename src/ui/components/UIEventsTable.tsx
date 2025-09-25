import { raw } from "hono/html";
import type { FC } from "hono/jsx";
import type { UIEvent, UIEventDetails } from "../types/events.js";

function formatTime(timestamp: string, compact = false): string {
  const date = new Date(timestamp);
  if (compact) {
    // Show just time for today's events, or date for older ones
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }
  return date.toLocaleString();
}

function getEventTypeIcon(type: string): string {
  switch (type) {
    case "initialize":
      return "🚀";
    case "ping":
      return "📡";
    case "tool_list":
      return "🔧";
    case "tool_call":
      return "⚡";
    case "resource_list":
      return "📁";
    case "resource_read":
      return "📄";
    case "prompt_list":
      return "💭";
    case "prompt_get":
      return "🎯";
    case "notification":
      return "📢";
    case "completion":
      return "✅";
    case "elicitation":
      return "❓";
    default:
      return "🔹";
  }
}

export const UIEventsTable: FC<{
  events: UIEvent[];
  compact?: boolean;
}> = ({ events, compact = false }) => {
  if (events.length === 0) {
    return (
      <p>
        📭 No events yet. Events will appear here when the server starts
        processing requests.
      </p>
    );
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th class="width-min">Time</th>
            <th class="width-auto">Event</th>
            <th class="width-min">ID</th>
            {!compact && <th class="width-min">Server</th>}
            <th class="width-min">Duration</th>
            <th class="width-min">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <>
              <tr key={event.id}>
                <td title={new Date(event.timestamp).toLocaleString()}>
                  {formatTime(event.timestamp, compact)}
                </td>
                <td>
                  <span title={event.type}>{getEventTypeIcon(event.type)}</span>{" "}
                  {event.details ? (
                    <details>
                      <summary>{event.summary}</summary>
                    </details>
                  ) : (
                    event.summary
                  )}
                </td>
                <td>{event.requestId ?? "—"}</td>
                {!compact && <td>{event.metadata.serverName}</td>}
                <td>{event.metadata.durationMs}ms</td>
                <td>{event.status}</td>
              </tr>
              {event.details && (
                <tr
                  key={`${event.id}-detail`}
                  style={{ display: "none" }}
                  class="event-detail"
                >
                  <td></td>
                  <td colSpan={compact ? 4 : 5}>{renderEventDetails(event)}</td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {raw(`
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            // Handle details toggle for event expansion
            document.querySelectorAll('details').forEach(details => {
              details.addEventListener('toggle', function() {
                const row = this.closest('tr');
                const detailRow = row.nextElementSibling;
                if (detailRow && detailRow.classList.contains('event-detail')) {
                  detailRow.style.display = this.open ? 'table-row' : 'none';
                }
              });
            });
          });
        </script>
      `)}
    </>
  );
};

function renderEventDetails(event: UIEvent) {
  if (event.error) {
    return (
      <div>
        <p>
          <strong>❌ Error {event.error.code}</strong>
        </p>
        <p>
          <strong>Message:</strong> {event.error.message}
        </p>
        {event.error.data && (
          <div>
            <p>
              <strong>Details:</strong>
            </p>
            <pre>{JSON.stringify(event.error.data, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  }

  if (!event.details) {
    return (
      <p>
        <em>No additional details available</em>
      </p>
    );
  }

  return renderDetailsByType(event.details);
}

function renderDetailsByType(details: UIEventDetails) {
  // Simple fallback that just shows the raw data - no custom styling
  return (
    <div>
      <p>
        <strong>Event Details</strong>
      </p>
      <pre>{JSON.stringify(details, null, 2)}</pre>
    </div>
  );
}

// Server-specific events table component
export const ServerEventsTable: FC<{
  serverName: string;
  events?: UIEvent[];
  showEmpty?: boolean;
}> = ({ serverName, events, showEmpty = false }) => {
  if (showEmpty || !events || events.length === 0) {
    return <UIEventsTable events={[]} compact={true} />;
  }

  // Filter events for this server
  const serverEvents = events.filter(
    (e) => e.metadata.serverName === serverName,
  );

  return <UIEventsTable events={serverEvents} compact={true} />;
};

/**
 * Example usage of the new event data layer
 * This file demonstrates how to use the UI event types and utilities
 */

import type { CaptureRecord } from "../../schemas.js";
import type { UIEvent } from "../types/events.js";
import { transformCaptureRecord } from "./eventTransform.js";
import {
  generateFakeUIEvents,
  generateFakeUIEventsForServer,
} from "./fakeData.js";

// Example: Transform raw MCP events to UI events
export function transformRawEventsExample() {
  // Sample raw events (from your provided data)
  const rawEvents: CaptureRecord[] = [
    {
      timestamp: "2025-09-24T18:39:54.254Z",
      method: "initialize",
      id: 0,
      metadata: {
        serverName: "everything",
        sessionId: "stateless",
        durationMs: 21,
        httpStatus: 200,
        client: { name: "mcp-inspector", version: "0.16.8" },
      },
      request: {
        jsonrpc: "2.0",
        id: 0,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {
            sampling: {},
            elicitation: {},
            roots: { listChanged: true },
          },
          clientInfo: { name: "mcp-inspector", version: "0.16.8" },
        },
      },
      response: {
        jsonrpc: "2.0",
        id: 0,
        result: {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "comprehensive-mcp-demo", version: "2.0.0" },
          capabilities: {
            tools: { listChanged: true },
            resources: { listChanged: true },
            prompts: { listChanged: true },
          },
        },
      },
    },
  ];

  // Transform to UI events
  const uiEvents: UIEvent[] = rawEvents.map(transformCaptureRecord);

  console.log("Transformed UI Events:", uiEvents);
  return uiEvents;
}

// Example: Generate fake data for development
export function generateFakeDataExample() {
  // Generate 20 fake events for development/testing
  const fakeEvents = generateFakeUIEvents(20);

  // Generate events for a specific server
  const serverEvents = generateFakeUIEventsForServer("my-server", 10);

  console.log("Fake Events:", fakeEvents);
  console.log("Server Events:", serverEvents);

  return { fakeEvents, serverEvents };
}

// Example: Filter and process events
export function filterEventsExample(events: UIEvent[]) {
  // Filter by event type
  const toolEvents = events.filter((e) => e.type === "tool_call");

  // Filter by status
  const errorEvents = events.filter((e) => e.status === "error");

  // Filter by server
  const specificServerEvents = events.filter(
    (e) => e.metadata.serverName === "my-server",
  );

  // Filter by time range (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentEvents = events.filter((e) => new Date(e.timestamp) > oneHourAgo);

  // Group by server
  const eventsByServer = events.reduce(
    (acc, event) => {
      const server = event.metadata.serverName;
      if (!acc[server]) acc[server] = [];
      acc[server].push(event);
      return acc;
    },
    {} as Record<string, UIEvent[]>,
  );

  return {
    toolEvents,
    errorEvents,
    specificServerEvents,
    recentEvents,
    eventsByServer,
  };
}

// Example: Create summary statistics
export function createEventSummary(events: UIEvent[]) {
  const summary = {
    total: events.length,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    byServer: {} as Record<string, number>,
    averageDuration: 0,
    errorRate: 0,
  };

  let totalDuration = 0;
  let errorCount = 0;

  events.forEach((event) => {
    // Count by type
    summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;

    // Count by status
    summary.byStatus[event.status] = (summary.byStatus[event.status] || 0) + 1;

    // Count by server
    const server = event.metadata.serverName;
    summary.byServer[server] = (summary.byServer[server] || 0) + 1;

    // Calculate averages
    totalDuration += event.metadata.durationMs;
    if (event.status === "error") errorCount++;
  });

  summary.averageDuration =
    events.length > 0 ? Math.round(totalDuration / events.length) : 0;
  summary.errorRate =
    events.length > 0 ? Math.round((errorCount / events.length) * 100) : 0;

  return summary;
}

// Example: Real-time event processing
export class EventProcessor {
  private events: UIEvent[] = [];
  private listeners: Array<(events: UIEvent[]) => void> = [];

  // Add a new event (e.g., from WebSocket or polling)
  addEvent(rawEvent: CaptureRecord) {
    const uiEvent = transformCaptureRecord(rawEvent);
    this.events.unshift(uiEvent); // Add to beginning for newest-first

    // Keep only last 1000 events to prevent memory issues
    if (this.events.length > 1000) {
      this.events = this.events.slice(0, 1000);
    }

    // Notify listeners
    // biome-ignore lint/suspicious/useIterableCallbackReturn: fake data utils its fine
    this.listeners.forEach((listener) => listener(this.events));
  }

  // Subscribe to event updates
  subscribe(listener: (events: UIEvent[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Get current events with optional filtering
  getEvents(filter?: {
    serverName?: string;
    type?: string;
    status?: string;
    limit?: number;
  }) {
    let filtered = this.events;

    if (filter) {
      if (filter.serverName) {
        filtered = filtered.filter(
          (e) => e.metadata.serverName === filter.serverName,
        );
      }
      if (filter.type) {
        filtered = filtered.filter((e) => e.type === filter.type);
      }
      if (filter.status) {
        filtered = filtered.filter((e) => e.status === filter.status);
      }
      if (filter.limit) {
        filtered = filtered.slice(0, filter.limit);
      }
    }

    return filtered;
  }

  // Get summary stats
  getSummary() {
    return createEventSummary(this.events);
  }
}

// Usage in a component would look like:
/*
import { UIEventsTable } from "../components/UIEventsTable.jsx";
import { generateFakeUIEvents } from "./fakeData.js";

export const MyEventsDashboard = () => {
  // Use fake data for development
  const events = generateFakeUIEvents(50);

  return (
    <div>
      <h2>Recent Events</h2>
      <UIEventsTable events={events} />
    </div>
  );
};
*/

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { captureRecordSchema } from "../../schemas.js";
import type { UIEvent } from "../types/events.js";
import { transformCaptureRecord } from "./eventTransform.js";

/**
 * Read recent events from JSONL capture files
 */
export async function readRecentEvents(
  storageDir: string,
  serverNames: string[],
  limit: number = 100,
): Promise<UIEvent[]> {
  const events: UIEvent[] = [];

  try {
    // Read events from all servers
    for (const serverName of serverNames) {
      const serverEvents = await readServerEvents(
        storageDir,
        serverName,
        limit,
      );
      events.push(...serverEvents);
    }

    // Sort by timestamp descending (newest first) and limit
    return events
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  } catch (error) {
    console.warn("Failed to read events:", error);
    // Return empty array on error to gracefully degrade
    return [];
  }
}

/**
 * Read events for a specific server
 */
export async function readServerEvents(
  storageDir: string,
  serverName: string,
  limit: number = 50,
): Promise<UIEvent[]> {
  const events: UIEvent[] = [];
  const serverDir = join(storageDir, serverName);

  try {
    // Get all JSONL files in the server directory
    const files = await readdir(serverDir);
    const jsonlFiles = files.filter((file) => file.endsWith(".jsonl"));

    // Sort files by modification time (recent first) and take recent ones
    const sortedFiles = jsonlFiles.sort().reverse().slice(0, 10); // Max 10 recent files

    for (const file of sortedFiles) {
      const filePath = join(serverDir, file);
      const fileEvents = await readEventsFromFile(filePath);
      events.push(...fileEvents);

      // Stop if we have enough events
      if (events.length >= limit) {
        break;
      }
    }

    // Sort by timestamp and limit
    return events
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  } catch (error) {
    console.warn(`Failed to read events for server ${serverName}:`, error);
    return [];
  }
}

/**
 * Read and parse events from a single JSONL file
 */
async function readEventsFromFile(filePath: string): Promise<UIEvent[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    const events: UIEvent[] = [];

    for (const line of lines) {
      try {
        const rawRecord = JSON.parse(line);

        // Validate the record structure
        const parseResult = captureRecordSchema.safeParse(rawRecord);
        if (!parseResult.success) {
          console.warn("Invalid capture record format:", parseResult.error);
          continue;
        }

        // Transform to UI event
        const uiEvent = transformCaptureRecord(parseResult.data);
        events.push(uiEvent);
      } catch (lineError) {
        console.warn("Failed to parse JSONL line:", lineError);
        // Continue processing other lines
      }
    }

    return events;
  } catch (error) {
    console.warn(`Failed to read file ${filePath}:`, error);
    return [];
  }
}

/**
 * Get event count statistics
 */
export async function getEventStats(
  storageDir: string,
  serverNames: string[],
): Promise<{
  totalEvents: number;
  eventsByServer: Record<string, number>;
  recentEventCount: number; // Last hour
}> {
  let totalEvents = 0;
  const eventsByServer: Record<string, number> = {};
  let recentEventCount = 0;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    for (const serverName of serverNames) {
      const events = await readServerEvents(storageDir, serverName, 1000); // Read more for stats
      eventsByServer[serverName] = events.length;
      totalEvents += events.length;

      // Count recent events
      const recentEvents = events.filter(
        (e) => new Date(e.timestamp) > oneHourAgo,
      );
      recentEventCount += recentEvents.length;
    }
  } catch (error) {
    console.warn("Failed to calculate event stats:", error);
  }

  return {
    totalEvents,
    eventsByServer,
    recentEventCount,
  };
}

/**
 * Get events filtered by criteria
 */
export async function getFilteredEvents(
  storageDir: string,
  serverNames: string[],
  filters: {
    method?: string;
    status?: "success" | "error" | "pending" | "info";
    serverName?: string;
    searchQuery?: string;
    limit?: number;
  } = {},
): Promise<UIEvent[]> {
  const limit = filters.limit || 100;

  // If filtering by specific server, only read from that server
  const serversToRead = filters.serverName ? [filters.serverName] : serverNames;

  let events = await readRecentEvents(storageDir, serversToRead, limit * 2); // Read more to account for filtering

  // Apply filters
  if (filters.method) {
    events = events.filter((e) => e.method === filters.method);
  }

  if (filters.status) {
    events = events.filter((e) => e.status === filters.status);
  }

  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    events = events.filter(
      (e) =>
        e.method.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query) ||
        e.metadata.serverName.toLowerCase().includes(query),
    );
  }

  return events.slice(0, limit);
}

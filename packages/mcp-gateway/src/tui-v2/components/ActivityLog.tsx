import { useKeyboard } from "@opentui/react";
import { useEffect, useRef, useState } from "react";
import { getClientInfo } from "../../capture";
import type { LogEntry } from "../../tui/state";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { useHandler } from "../hooks/useHandler";

type BoxRef = { height: number; onSizeChange?: () => void };

// Format request-specific details
function formatRequestDetails(log: LogEntry): string {
  if (!log.request?.params) return "";

  const params = log.request.params as Record<string, unknown>;

  // tools/call: show tool name and args
  if (log.method === "tools/call") {
    const toolName = params.name as string;
    const args = params.arguments as Record<string, unknown>;
    const argStr = Object.entries(args || {})
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join(", ");
    return ` ${toolName}${argStr ? `(${argStr})` : ""}`;
  }

  // resources/read: show URI
  if (log.method === "resources/read") {
    const uri = params.uri as string;
    return ` ${uri}`;
  }

  return "";
}

// Format response-specific details
function formatResponseDetails(log: LogEntry): string {
  if (!log.response || "error" in log.response) return "";

  const result = log.response.result as Record<string, unknown>;

  // initialize: show server name and version
  if (log.method === "initialize") {
    const serverInfo = result.serverInfo as { name: string; version: string };
    return ` → ${serverInfo.name}@${serverInfo.version}`;
  }

  // tools/list: show count and first few tool names
  if (log.method === "tools/list") {
    const tools = result.tools as Array<{ name: string }>;
    const toolNames = tools.slice(0, 3).map((t) => t.name);
    const more = tools.length > 3 ? `, +${tools.length - 3}` : "";
    return ` ${tools.length} tools: ${toolNames.join(", ")}${more}`;
  }

  // tools/call: show result text (truncated)
  if (log.method === "tools/call") {
    const content = result.content as Array<{ type: string; text?: string }>;
    const textContent = content?.find((c) => c.type === "text")?.text;
    if (textContent) {
      const truncated =
        textContent.length > 40
          ? `${textContent.slice(0, 40)}...`
          : textContent;
      return ` "${truncated}"`;
    }
  }

  // resources/list: show count
  if (log.method === "resources/list") {
    const resources = result.resources as unknown[];
    return ` ${resources?.length || 0} resources`;
  }

  // prompts/list: show count
  if (log.method === "prompts/list") {
    const prompts = result.prompts as unknown[];
    return ` ${prompts?.length || 0} prompts`;
  }

  return "";
}

// Format a single log entry
function formatLogEntry(log: LogEntry): string {
  const clientInfo = getClientInfo(log.sessionId);
  const clientLabel = clientInfo
    ? `${clientInfo.name}@${clientInfo.version}`
    : "client";
  const sessionIdShort = `[${log.sessionId.slice(0, 8)}]`;
  const timestamp = log.timestamp.slice(11, 19);

  if (log.direction === "request") {
    // Client → Gateway → Server (request flow)
    const methodDetails = formatRequestDetails(log);
    return `${timestamp} ${sessionIdShort} ${clientLabel} → ${log.serverName} ${log.method}${methodDetails}`;
  }

  // Server → Gateway → Client (response flow)
  const responseDetails = formatResponseDetails(log);
  const errorSuffix = log.errorMessage ? ` ${log.errorMessage}` : "";
  return `${timestamp} ${sessionIdShort} ${log.serverName} → ${clientLabel} (${log.httpStatus}, ${log.duration}ms)${responseDetails}${errorSuffix}`;
}

export function ActivityLog() {
  const theme = useTheme();
  const logs = useAppStore((state) => state.logs);

  // Get color for status code
  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return theme.success;
    if (status >= 400 && status < 500) return theme.warning;
    return theme.danger;
  };

  // Container ref to get actual rendered height
  const containerRef = useRef<BoxRef | null>(null);
  const containerHeightRef = useRef(10);

  // Selection state
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Line-based scroll position - which line (pixel) is at the top of viewport
  const [scrollPosition, setScrollPosition] = useState(0);
  // Follow mode state - explicit opt-in
  const [isFollowMode, setIsFollowMode] = useState(true);

  // Defensive: ensure selectedIndex is always valid
  const safeSelectedIndex = Math.max(
    0,
    Math.min(selectedIndex, Math.max(0, logs.length - 1)),
  );

  // Height tracking: for now all items are 1 line, but this supports variable heights
  const itemHeights = logs.map(() => 1); // TODO: track actual rendered heights

  // Calculate cumulative positions (where each item starts in line-space)
  const itemPositions = itemHeights.reduce<number[]>(
    (positions, _height, i) => {
      positions.push(
        i === 0 ? 0 : (positions[i - 1] ?? 0) + (itemHeights[i - 1] ?? 1),
      );
      return positions;
    },
    [],
  );

  // Viewport info
  const viewportHeight = Math.max(1, containerHeightRef.current);
  const viewportStart = scrollPosition;
  const viewportEnd = scrollPosition + viewportHeight;

  // Helper: is an item visible in current viewport?
  const isItemVisible = (index: number): boolean => {
    if (index < 0 || index >= logs.length) return false;
    const itemStart = itemPositions[index] ?? 0;
    const itemEnd = itemStart + (itemHeights[index] ?? 1);
    return itemEnd > viewportStart && itemStart < viewportEnd;
  };

  // Calculate overflow indicators
  const itemsAbove = logs.filter((_, i) => {
    const itemEnd = (itemPositions[i] ?? 0) + (itemHeights[i] ?? 1);
    return itemEnd <= viewportStart;
  }).length;

  const itemsBelow = logs.filter((_, i) => {
    const itemStart = itemPositions[i] ?? 0;
    return itemStart >= viewportEnd;
  }).length;

  // Auto-scroll to keep selection visible
  useEffect(() => {
    if (logs.length === 0 || itemPositions.length === 0) return;

    const selectedItemStart = itemPositions[safeSelectedIndex] ?? 0;
    const selectedItemEnd =
      selectedItemStart + (itemHeights[safeSelectedIndex] ?? 1);

    setScrollPosition((currentScroll) => {
      const viewportStart = currentScroll;
      const viewportEnd = currentScroll + viewportHeight;

      // If selected item starts above viewport, scroll up to show it at top
      if (selectedItemStart < viewportStart) {
        return Math.max(0, selectedItemStart);
      }

      // If selected item ends below viewport, scroll down to show it at bottom
      if (selectedItemEnd > viewportEnd) {
        return Math.max(0, selectedItemEnd - viewportHeight);
      }

      // Item is fully visible, don't scroll
      return currentScroll;
    });
  }, [safeSelectedIndex, itemPositions, itemHeights, viewportHeight]);

  // Auto-follow when in follow mode and new logs arrive
  useEffect(() => {
    if (logs.length === 0) {
      setSelectedIndex(0);
      setScrollPosition(0);
      return;
    }

    if (selectedIndex >= logs.length) {
      setSelectedIndex(logs.length - 1);
    }

    // When in follow mode, always move selection to the last item
    if (isFollowMode) {
      setSelectedIndex(logs.length - 1);
    }
  }, [logs.length, isFollowMode, selectedIndex]);

  // Keyboard navigation
  useKeyboard((key) => {
    if (logs.length === 0) return;

    if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      // Exit follow mode when scrolling up
      if (isFollowMode) {
        setIsFollowMode(false);
      }
    }
    if (key.name === "down") {
      setSelectedIndex((prev) => {
        const next = Math.min(logs.length - 1, prev + 1);
        // If we're at the last item and press down again, enter follow mode
        if (prev === logs.length - 1 && next === logs.length - 1) {
          setIsFollowMode(true);
        }
        return next;
      });
    }
    if (key.name === "left") {
      // Page up
      setSelectedIndex((prev) => Math.max(0, prev - 10));
      // Exit follow mode when scrolling up
      if (isFollowMode) {
        setIsFollowMode(false);
      }
    }
    if (key.name === "right") {
      // Page down
      setSelectedIndex((prev) => Math.min(logs.length - 1, prev + 10));
    }
    if (key.name === "home") {
      setSelectedIndex(0);
      // Exit follow mode when jumping to top
      if (isFollowMode) {
        setIsFollowMode(false);
      }
    }
    if (key.name === "end") {
      setSelectedIndex(logs.length - 1);
      // Enter follow mode when pressing End
      setIsFollowMode(true);
    }
  });

  const updateHeight = useHandler((ref: BoxRef) => {
    const newHeight = ref.height;
    if (newHeight > 0 && newHeight !== containerHeightRef.current) {
      containerHeightRef.current = newHeight;
    }
  });

  if (logs.length === 0) {
    return (
      <box
        style={{
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexGrow: 1,
          padding: 4,
        }}
      >
        <text fg={theme.accent} style={{ marginBottom: 2 }}>
          Welcome to MCP Gateway!
        </text>

        <text fg={theme.foreground}>
          This gateway routes MCP requests to one or more servers.
        </text>

        <text fg={theme.foregroundMuted} style={{ marginBottom: 1 }}>
          Activity will appear here as requests flow through.
        </text>

        <box
          style={{
            flexDirection: "column",
            border: true,
            borderColor: theme.border,
            width: "80%",
            gap: 1,
          }}
        >
          <box style={{ flexDirection: "row" }}>
            <text
              fg={theme.accent}
              style={{ marginBottom: 1, flexBasis: "auto" }}
            >
              Get Started:
            </text>
          </box>
          <box
            style={{ flexDirection: "column", padding: 1, flexGrow: 1, gap: 1 }}
          >
            <box style={{ flexDirection: "row" }}>
              <text fg={theme.foreground}>
                1. Press [a] to add your first MCP server
              </text>
            </box>
            <box
              style={{
                flexDirection: "row",
                borderColor: theme.border,
                gap: 1,
              }}
            >
              <text fg={theme.foreground}>
                2. Configure your MCP client to use:
              </text>
              <text fg={theme.foregroundMuted} style={{ paddingLeft: 3 }}>
                http://localhost:3333/gateway/mcp
              </text>
            </box>
            <text fg={theme.foreground}>
              3. Send requests and watch them here
            </text>
          </box>
          <box style={{ flexDirection: "row" }}>
            <text fg={theme.foregroundMuted} style={{ marginTop: 2 }}>
              Press [m] for more information • [s] to manage servers
            </text>
          </box>
        </box>
      </box>
    );
  }

  return (
    <box
      style={{
        flexDirection: "column",
        flexGrow: 1,
        maxHeight: "100%",
      }}
    >
      {/* Header with status and overflow indicators */}
      <box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        {/* Left: Title */}
        <text fg={theme.accent}>Recent Activity</text>

        {/* Center: Overflow indicators */}
        <box
          style={{
            flexDirection: "row",
            gap: 1,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          {itemsAbove > 0 && (
            <text fg={theme.foregroundMuted}>[↑ {itemsAbove} more]</text>
          )}
        </box>

        {/* Right: Position counter */}
        <text fg={theme.foregroundMuted}>
          [{safeSelectedIndex + 1}/{logs.length}]
        </text>
      </box>

      {/* Main content area */}
      <box
        ref={(ref) => {
          if (ref) {
            containerRef.current = ref;
            updateHeight(ref);
            // Listen for size changes (terminal resize)
            ref.onSizeChange = () => {
              updateHeight(ref);
            };
          }
        }}
        style={{
          flexGrow: 1,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          width: "100%",
        }}
      >
        {/* Render visible items */}
        {logs.map((log, i) => {
          // Skip items outside viewport
          if (!isItemVisible(i)) return null;

          const isSelected = i === safeSelectedIndex;
          const color =
            log.direction === "response"
              ? getStatusColor(log.httpStatus)
              : theme.foregroundMuted;

          return (
            <box
              key={`${log.sessionId}-${log.timestamp}-${log.direction}`}
              style={{
                backgroundColor: isSelected ? theme.emphasis : undefined,
              }}
            >
              <text fg={isSelected ? theme.accent : color}>
                {isSelected ? "> " : "  "}
                {formatLogEntry(log)}
              </text>
            </box>
          );
        })}
      </box>

      {/* Bottom overflow/follow indicator */}
      {isFollowMode ? (
        <box
          style={{
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <text fg={theme.accent}>
            [Following new items - Press ↑ to pause]
          </text>
        </box>
      ) : itemsBelow > 0 ? (
        <box
          style={{
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <text fg={theme.foregroundMuted}>
            [↓ {itemsBelow} more {itemsBelow === 1 ? "item" : "items"} - Press
            End to follow]
          </text>
        </box>
      ) : null}
    </box>
  );
}

import { useKeyboard } from "@opentui/react";
import { useEffect, useRef, useState } from "react";
import { useHandler } from "../hooks/useHandler";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { ActivityLogEntry } from "./ActivityLogEntry";
import { ActivityLogHeader } from "./ActivityLogHeader";

type BoxRef = { height: number; onSizeChange?: () => void };

export function ActivityLog() {
  const theme = useTheme();
  const logs = useAppStore((state) => state.logs);

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

  return (
    <box
      style={{
        flexDirection: "column",
        flexGrow: 1,
        maxHeight: "100%",
        border: false,
        // borderColor: theme.border,
      }}
    >
      {/* Header with status and overflow indicators */}
      <ActivityLogHeader
        totalLogs={logs.length}
        selectedIndex={safeSelectedIndex}
        itemsAbove={itemsAbove}
      />

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
          flexBasis: 1,
          flexDirection: "column",
          paddingLeft: 1,
          paddingRight: 1,
          width: "100%",
        }}
      >
        {/* Render visible items */}
        {logs.map((log, i) => {
          // Skip items outside viewport
          if (!isItemVisible(i)) {
            return null;
          }

          const isSelected = i === safeSelectedIndex;

          return (
            <ActivityLogEntry
              key={`${log.sessionId}-${log.timestamp}-${log.direction}`}
              log={log}
              isSelected={isSelected}
            />
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
            alignItems: "center",
          }}
        >
          <text fg={theme.foregroundMuted}>
            [↓ {itemsBelow} more {itemsBelow === 1 ? "item" : "items"} - Press
            End to follow]
          </text>
        </box>
      ) : (
        <box style={{ height: 1 }} />
      )}
    </box>
  );
}

import { useEffect, useState } from "react";
import type { LogEntry } from "../../../tui/state";

/**
 * Custom hook to manage scroll state and viewport logic for the activity log
 */
export function useActivityLogScroll(logs: LogEntry[], viewportHeight: number) {
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

  return {
    selectedIndex: safeSelectedIndex,
    setSelectedIndex,
    scrollPosition,
    isFollowMode,
    setIsFollowMode,
    isItemVisible,
    itemsAbove,
    itemsBelow,
  };
}

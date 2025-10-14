import { useEffect } from "react";
import type { LogEntry } from "@fiberplane/mcp-gateway-types";
import { useAppStore } from "../../store";

/**
 * Custom hook to manage scroll state and viewport logic for the activity log
 * Now uses Zustand store to persist state across view changes
 */
export function useActivityLogScroll(logs: LogEntry[], viewportHeight: number) {
  // Get state from store
  const selectedIndex = useAppStore((state) => state.activityLogSelectedIndex);
  const setSelectedIndex = useAppStore(
    (state) => state.setActivityLogSelectedIndex,
  );
  const scrollPosition = useAppStore(
    (state) => state.activityLogScrollPosition,
  );
  const setScrollPosition = useAppStore(
    (state) => state.setActivityLogScrollPosition,
  );
  const isFollowMode = useAppStore((state) => state.activityLogFollowMode);
  const setIsFollowMode = useAppStore(
    (state) => state.setActivityLogFollowMode,
  );

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

    const viewportStart = scrollPosition;
    const viewportEnd = scrollPosition + viewportHeight;

    // If selected item starts above viewport, scroll up to show it at top
    if (selectedItemStart < viewportStart) {
      setScrollPosition(Math.max(0, selectedItemStart));
      return;
    }

    // If selected item ends below viewport, scroll down to show it at bottom
    if (selectedItemEnd > viewportEnd) {
      setScrollPosition(Math.max(0, selectedItemEnd - viewportHeight));
      return;
    }

    // Item is fully visible, don't scroll
  }, [
    logs.length,
    safeSelectedIndex,
    itemPositions,
    itemHeights,
    viewportHeight,
    scrollPosition,
    setScrollPosition,
  ]);

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
  }, [
    logs.length,
    isFollowMode,
    selectedIndex,
    setSelectedIndex,
    setScrollPosition,
  ]);

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

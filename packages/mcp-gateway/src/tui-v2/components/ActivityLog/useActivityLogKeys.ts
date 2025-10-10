import { useKeyboard } from "@opentui/react";
import type { LogEntry } from "../../../tui/state";
import { useAppStore } from "../../store";

interface ScrollState {
  selectedIndex: number;
  setSelectedIndex: (value: number | ((prev: number) => number)) => void;
  isFollowMode: boolean;
  setIsFollowMode: (value: boolean) => void;
}

/**
 * Custom hook to handle keyboard navigation for the activity log
 */
export function useActivityLogKeys(scroll: ScrollState, logs: LogEntry[]) {
  const openModal = useAppStore((state) => state.openModal);
  const setSelectedLog = useAppStore((state) => state.setSelectedLog);
  const activeModal = useAppStore((state) => state.activeModal);

  useKeyboard((key) => {
    // Don't process keys if a modal is open
    if (activeModal) return;
    if (logs.length === 0) return;

    const { selectedIndex, setSelectedIndex, isFollowMode, setIsFollowMode } =
      scroll;

    if (key.name === "return" || key.name === "enter") {
      // Open detail modal for selected log
      const selectedLog = logs[selectedIndex];
      if (selectedLog) {
        setSelectedLog(selectedLog);
        openModal("activity-log-detail");
      }
      return;
    }

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
}

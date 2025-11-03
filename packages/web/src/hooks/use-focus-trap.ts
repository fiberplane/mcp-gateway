/**
 * Focus trap hook for modal accessibility
 *
 * Traps keyboard focus within a container element (typically a modal),
 * ensuring users navigating with Tab/Shift+Tab stay within the modal.
 */

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus within a container element
 *
 * @param active Whether the focus trap is active
 * @returns Ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active = true,
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Get all focusable elements within container
    const getFocusableElements = () => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        // Filter out disabled and hidden elements
        (el) =>
          !el.hasAttribute("disabled") &&
          el.offsetParent !== null &&
          window.getComputedStyle(el).visibility !== "hidden",
      );
    };

    // Handle Tab key navigation
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab on first element -> focus last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
      // Tab on last element -> focus first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    // Focus first element when trap activates
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure modal is rendered
      setTimeout(() => focusableElements[0]?.focus(), 10);
    }

    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, [active]);

  return containerRef;
}

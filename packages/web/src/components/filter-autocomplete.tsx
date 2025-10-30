/**
 * Autocomplete dropdown for filter input
 *
 * Shows suggestions for fields, operators, and values
 * as the user types in the command filter input.
 */

import { useEffect, useRef, useState } from "react";
import type { FilterSuggestion } from "@/lib/filter-parser";
import { useHandler } from "@/lib/use-handler";
import { cn } from "@/lib/utils";

interface FilterAutocompleteProps {
  /**
   * Autocomplete suggestions to display
   */
  suggestions: FilterSuggestion[];

  /**
   * Whether the autocomplete is open
   */
  open: boolean;

  /**
   * Callback when a suggestion is selected
   */
  onSelect: (suggestion: FilterSuggestion) => void;

  /**
   * Callback when autocomplete should close
   */
  onClose: () => void;

  /**
   * Optional error content to display at top of dropdown
   */
  errorContent?: React.ReactNode;

  /**
   * Optional preview content to display at top of dropdown
   */
  previewContent?: React.ReactNode;
}

export function FilterAutocomplete({
  suggestions,
  open,
  onSelect,
  onClose,
  errorContent,
  previewContent,
}: FilterAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLElement>(null);

  // Reset selection when suggestions change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset on suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation - use stable handler to avoid memory leaks
  const handleKeyDown = useHandler((e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Tab":
        // Tab (without shift) selects highlighted suggestion (for guided completion)
        // Only if there are suggestions and selectedIndex is valid
        if (
          !e.shiftKey &&
          suggestions.length > 0 &&
          selectedIndex >= 0 &&
          selectedIndex < suggestions.length
        ) {
          e.preventDefault();
          const suggestion = suggestions[selectedIndex];
          if (suggestion) {
            onSelect(suggestion);
          }
        }
        // Otherwise, let Tab navigate normally (don't prevent default)
        break;
      // Enter is NOT handled here - let it submit the typed value
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  });

  useEffect(() => {
    if (!open) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;

    // Bounds check before accessing children array
    if (selectedIndex < 0 || selectedIndex >= listRef.current.children.length) {
      return;
    }

    const selectedElement = listRef.current.children[selectedIndex];
    if (selectedElement instanceof HTMLElement) {
      selectedElement.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Show dropdown if open AND (has suggestions OR has error/preview content)
  if (!open || (suggestions.length === 0 && !errorContent && !previewContent)) {
    return null;
  }

  return (
    <section
      ref={listRef}
      className={cn(
        "absolute z-50 mt-1 w-full",
        "rounded-md border border-border bg-popover shadow-lg",
        "max-h-[400px] overflow-y-auto",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      aria-label="Filter assistance"
    >
      {/* Live region for screen reader announcements */}
      {/* biome-ignore lint/a11y/useSemanticElements: Live region for screen readers, div is appropriate */}
      <div role="status" aria-live="polite" className="sr-only">
        {suggestions.length > 0
          ? `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} available`
          : errorContent
            ? "Error in filter input"
            : "No suggestions"}
      </div>

      {/* Error/Preview section (sticky at top) */}
      {(errorContent || previewContent) && (
        <div className="sticky top-0 z-10 bg-popover">
          {errorContent}
          {previewContent}
        </div>
      )}

      {/* Suggestions section */}
      {suggestions.length > 0 && (
        <>
          {/* biome-ignore lint/correctness/useUniqueElementIds: Singleton component, static ID is acceptable for ARIA */}
          <div
            id="filter-autocomplete-listbox"
            role="listbox"
            aria-label="Filter suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.text}-${index}`}
                id={`filter-suggestion-${index}`}
                type="button"
                className={cn(
                  "w-full px-3 py-1.5 text-left",
                  "flex flex-col gap-0.5",
                  "transition-colors cursor-pointer",
                  "focus:outline-none",
                  index === selectedIndex
                    ? "bg-primary/10 text-foreground border-l-2 border-primary"
                    : "hover:bg-primary/5 border-l-2 border-transparent",
                )}
                onClick={() => onSelect(suggestion)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                {/* Main suggestion text - field name only */}
                <div
                  className="flex items-center gap-2"
                  title={suggestion.description}
                >
                  {suggestion.icon && (
                    <span className="size-4">{suggestion.icon}</span>
                  )}
                  <span className="font-medium text-sm leading-tight">
                    {suggestion.display}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Keyboard hints */}
          <div className="sticky bottom-0 px-3 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              Tab
            </kbd>{" "}
            to select •{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              Enter
            </kbd>{" "}
            to search •{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
              Esc
            </kbd>{" "}
            to close
          </div>
        </>
      )}
    </section>
  );
}

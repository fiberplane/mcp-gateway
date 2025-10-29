/**
 * Autocomplete dropdown for filter input
 *
 * Shows suggestions for fields, operators, and values
 * as the user types in the command filter input.
 */

import { useEffect, useRef, useState } from "react";
import type { FilterSuggestion } from "@/lib/filter-parser";
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
   * Reference element to position the dropdown relative to
   */
  anchorRef: React.RefObject<HTMLInputElement | null>;

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
  // @ts-expect-error - anchorRef reserved for future positioning logic
  anchorRef,
  errorContent,
  previewContent,
}: FilterAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLElement>(null);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
          // Tab selects highlighted suggestion (for guided completion)
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex]);
          }
          break;
        // Enter is NOT handled here - let it submit the typed value
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, suggestions, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.children[
      selectedIndex
    ] as HTMLElement;
    if (selectedElement) {
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
      {/* Error/Preview section (sticky at top) */}
      {(errorContent || previewContent) && (
        <div className="sticky top-0 z-10 bg-popover">
          {errorContent}
          {previewContent}
        </div>
      )}

      {/* Suggestions section */}
      {suggestions.length > 0 && (
        <div role="listbox" aria-label="Filter suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.text}-${index}`}
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
              {/* Main suggestion text */}
              <div className="flex items-center gap-2">
                {suggestion.icon && (
                  <span className="size-4">{suggestion.icon}</span>
                )}
                <span className="font-medium text-sm leading-tight">
                  {suggestion.display}
                </span>
              </div>

              {/* Description */}
              {suggestion.description && (
                <span className="text-xs text-muted-foreground leading-tight">
                  {suggestion.description}
                </span>
              )}

              {/* Example */}
              {suggestion.example && (
                <code className="text-xs text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded font-mono leading-none">
                  {suggestion.example}
                </code>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

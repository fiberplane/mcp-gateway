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
}

export function FilterAutocomplete({
  suggestions,
  open,
  onSelect,
  onClose,
  // @ts-expect-error - anchorRef reserved for future positioning logic
  anchorRef,
}: FilterAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

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
        case "Enter":
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            onSelect(suggestions[selectedIndex]);
          }
          break;
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

  if (!open || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute z-50 mt-1 w-full",
        "rounded-md border border-border bg-popover shadow-lg",
        "max-h-[300px] overflow-y-auto",
        "animate-in fade-in-0 zoom-in-95",
      )}
      role="listbox"
      aria-label="Filter suggestions"
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.text}-${index}`}
          type="button"
          className={cn(
            "w-full px-3 py-2 text-left",
            "flex flex-col gap-1",
            "transition-colors cursor-pointer",
            "focus:outline-none",
            index === selectedIndex
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50",
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
            <span className="font-medium text-sm">{suggestion.display}</span>
          </div>

          {/* Description */}
          {suggestion.description && (
            <span className="text-xs text-muted-foreground">
              {suggestion.description}
            </span>
          )}

          {/* Example */}
          {suggestion.example && (
            <code className="text-xs text-muted-foreground bg-muted px-1 rounded">
              {suggestion.example}
            </code>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Command-based filter input with natural language parsing
 *
 * Allows users to type filters like:
 * - tokens > 150
 * - duration < 25
 * - client is claude-code
 */

import {
  createFilter,
  createSearchTerm,
  type Filter,
  type SearchTerm,
} from "@fiberplane/mcp-gateway-types";
import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatErrorMessage } from "@/lib/filter-errors";
import {
  type FilterSuggestion,
  getAutocompleteSuggestions,
  parseInput,
  validateFilterInput,
} from "@/lib/filter-parser";
import { useHandler } from "@/lib/use-handler";
import { cn } from "@/lib/utils";
import { FilterAutocomplete } from "./filter-autocomplete";
import { FilterBadge } from "./filter-badge";
import { SearchPill } from "./search-pill";
import { Button } from "./ui/button";

interface CommandFilterInputProps {
  /**
   * Callback when a filter is added
   */
  onAddFilter: (filter: Filter) => void;

  /**
   * Callback when a search term is added
   */
  onAddSearch: (searchTerm: SearchTerm) => void;

  /**
   * Optional placeholder text
   */
  placeholder?: string;

  /**
   * Initial value to populate input (for editing)
   */
  initialValue?: string;

  /**
   * Optional callback when editing is cancelled (Escape pressed)
   */
  onCancel?: () => void;
}

export function CommandFilterInput({
  onAddFilter,
  onAddSearch,
  placeholder = "Search or filter: error, tokens > 150, client is claude-code...",
  initialValue,
  onCancel,
}: CommandFilterInputProps) {
  const [inputValue, setInputValue] = useState(initialValue || "");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input when initialValue changes (for editing)
  useEffect(() => {
    if (initialValue) {
      setInputValue(initialValue);
      setShowAutocomplete(false);
      // Focus and select all text for easy editing
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [initialValue]);

  // Validate current input
  const trimmed = inputValue.trim();
  const validation = trimmed ? validateFilterInput(inputValue) : null;

  // Input is valid if:
  // 1. It's a valid filter, OR
  // 2. It's non-empty (will be treated as search)
  const isValid = trimmed.length > 0;

  // Only show errors for incomplete filters (not for plain search text)
  const error =
    validation?.valid === false && validation.error.type !== "unknown_field"
      ? validation.error
      : null;

  // Get autocomplete suggestions
  const suggestions = showAutocomplete
    ? getAutocompleteSuggestions(inputValue)
    : [];

  // Handle adding filter or search
  const handleAdd = useHandler(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Parse input to determine type
    const result = parseInput(trimmed);
    if (!result) return;

    if (result.type === "filter") {
      // Add as filter
      const filter = createFilter(result.filter);
      onAddFilter(filter);
    } else {
      // Add as search term
      const searchTerm = createSearchTerm(result.query);
      onAddSearch(searchTerm);
    }

    // Clear input and keep focus
    setInputValue("");
    setShowAutocomplete(false);
    inputRef.current?.focus();
  });

  // Handle keyboard shortcuts
  const handleKeyDown = useHandler((e: React.KeyboardEvent) => {
    // Let autocomplete handle Enter when it has suggestions
    // Otherwise, we handle it here
    const hasActiveSuggestions = showAutocomplete && suggestions.length > 0;

    if (e.key === "Enter" && isValid && !hasActiveSuggestions) {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (showAutocomplete) {
        setShowAutocomplete(false);
      } else {
        setInputValue("");
        onCancel?.(); // Notify parent that editing was cancelled
      }
    }
  });

  // Handle input change
  const handleChange = useHandler((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowAutocomplete(true);
  });

  // Handle autocomplete selection
  const handleSelectSuggestion = useHandler((suggestion: FilterSuggestion) => {
    setInputValue(suggestion.text);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  });

  // Validation state for styling
  const validationState = !inputValue.trim()
    ? "empty"
    : isValid
      ? "valid"
      : "invalid";

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            "border rounded-md bg-background",
            "transition-colors",
            validationState === "valid" && "border-green-600",
            validationState === "invalid" && "border-red-600",
            "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
          )}
        >
          {/* Search icon */}
          <Search className="size-4 text-muted-foreground shrink-0" />

          {/* Input field */}
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="go"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => {
              // Delay to allow clicking autocomplete items
              setTimeout(() => setShowAutocomplete(false), 200);
            }}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent",
              "text-sm outline-none",
              "placeholder:text-muted-foreground",
            )}
            aria-label="Command filter input"
            aria-describedby="command-filter-help"
          />

          {/* Validation icon + status */}
          {validationState !== "empty" && (
            <div className="flex items-center gap-2 shrink-0">
              {isValid ? (
                <>
                  <Check className="size-4 text-green-600" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">
                    Press Enter
                  </span>
                </>
              ) : (
                <>
                  <X className="size-4 text-red-600" aria-hidden="true" />
                  <span className="text-xs text-red-600">Invalid</span>
                </>
              )}
            </div>
          )}

          {/* Add button */}
          <Button
            size="sm"
            variant={isValid ? "default" : "secondary"}
            disabled={!isValid}
            onClick={handleAdd}
            className="shrink-0"
          >
            Add
          </Button>
        </div>

        {/* Autocomplete dropdown */}
        <FilterAutocomplete
          suggestions={suggestions}
          open={showAutocomplete && suggestions.length > 0}
          onSelect={handleSelectSuggestion}
          onClose={() => setShowAutocomplete(false)}
          anchorRef={inputRef}
        />

        {/* Hidden help text for screen readers */}
        {/* biome-ignore lint/correctness/useUniqueElementIds: Singleton component, static ID is acceptable for ARIA */}
        <span id="command-filter-help" className="sr-only">
          Type a filter like "tokens &gt; 150" or "duration &lt; 25". Use Tab
          for autocomplete, Enter to add, Escape to clear.
        </span>
      </div>

      {/* Preview pill (when valid) */}
      {isValid &&
        trimmed &&
        (() => {
          const result = parseInput(trimmed);
          if (!result) return null;

          return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Preview:</span>
              {result.type === "filter" ? (
                <FilterBadge
                  filter={createFilter(result.filter)}
                  onRemove={() => {}} // No-op for preview
                />
              ) : (
                <SearchPill
                  searchTerm={createSearchTerm(result.query)}
                  onRemove={() => {}} // No-op for preview
                />
              )}
            </div>
          );
        })()}

      {/* Error message (when invalid) */}
      {error && (
        <div className="bg-warning/10 border border-warning/20 px-3 py-2 rounded-md text-sm text-warning-foreground">
          ⚠️ {formatErrorMessage(error)}
        </div>
      )}
    </div>
  );
}

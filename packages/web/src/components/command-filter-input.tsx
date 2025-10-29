/**
 * Command-based filter input with natural language parsing
 *
 * Allows users to type filters like:
 * - tokens > 150
 * - duration < 25
 * - client is claude-code
 */

import { createFilter, type Filter } from "@fiberplane/mcp-gateway-types";
import { Check, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatErrorMessage } from "@/lib/filter-errors";
import {
  type FilterSuggestion,
  getAutocompleteSuggestions,
  validateFilterInput,
} from "@/lib/filter-parser";
import { useHandler } from "@/lib/use-handler";
import { cn } from "@/lib/utils";
import { FilterAutocomplete } from "./filter-autocomplete";
import { FilterBadge } from "./filter-badge";
import { Button } from "./ui/button";

interface CommandFilterInputProps {
  /**
   * Callback when a filter is added
   */
  onAdd: (filter: Filter) => void;

  /**
   * Optional placeholder text
   */
  placeholder?: string;
}

export function CommandFilterInput({
  onAdd,
  placeholder = "Type filter: tokens > 150, duration < 25, client is claude-code...",
}: CommandFilterInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate current input
  const validation = inputValue.trim() ? validateFilterInput(inputValue) : null;
  const isValid = validation?.valid === true;
  const error = validation?.valid === false ? validation.error : null;

  // Get autocomplete suggestions
  const suggestions = showAutocomplete
    ? getAutocompleteSuggestions(inputValue)
    : [];

  // Handle adding filter
  const handleAdd = useHandler(() => {
    if (!validation || !validation.valid) return;

    // Parser returns FilterInput with correct discriminated union types
    const filter = createFilter(validation.filter);

    onAdd(filter);

    // Clear input and keep focus
    setInputValue("");
    setShowAutocomplete(false);
    inputRef.current?.focus();
  });

  // Handle keyboard shortcuts
  const handleKeyDown = useHandler((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid && !showAutocomplete) {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (showAutocomplete) {
        setShowAutocomplete(false);
      } else {
        setInputValue("");
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
      {isValid && validation.valid && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Preview:</span>
          <FilterBadge
            filter={createFilter(validation.filter)}
            onRemove={() => {}} // No-op for preview
          />
        </div>
      )}

      {/* Error message (when invalid) */}
      {error && (
        <div className="bg-warning/10 border border-warning/20 px-3 py-2 rounded-md text-sm text-warning-foreground">
          ⚠️ {formatErrorMessage(error)}
        </div>
      )}
    </div>
  );
}

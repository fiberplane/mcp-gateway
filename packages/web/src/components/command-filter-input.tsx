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
import { AlertCircle, Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatErrorMessage } from "@/lib/filter-errors";
import {
  type FilterSuggestion,
  getAutocompleteSuggestions,
  parseInput,
  validateFilterInput,
} from "@/lib/filter-parser";
import {
  useAvailableClients,
  useAvailableMethods,
  useAvailableServers,
  useAvailableSessions,
} from "@/lib/use-available-filters";
import { useHandler } from "@/lib/use-handler";
import { cn } from "@/lib/utils";
import { FilterAutocomplete } from "./filter-autocomplete";
import { FilterBadge } from "./filter-badge";
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
  const blurTimeoutRef = useRef<number | null>(null);

  // Fetch available values for autocomplete
  const { data: serversData } = useAvailableServers();
  const { data: clientsData } = useAvailableClients();
  const { data: methodsData } = useAvailableMethods();
  const { data: sessionsData } = useAvailableSessions();

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

  // Cleanup blur timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Validate current input
  const trimmed = inputValue.trim();
  const validation = trimmed ? validateFilterInput(inputValue) : null;

  // Input is valid if:
  // 1. It's a valid filter, OR
  // 2. It's non-empty (will be treated as search)
  const isValid = trimmed.length > 0;

  // Only show errors for truly invalid input (not incomplete or unknown field)
  // "incomplete" errors (missing operator/value) shouldn't show while typing
  const error =
    validation?.valid === false &&
    validation.error.type !== "unknown_field" &&
    validation.error.type !== "incomplete"
      ? validation.error
      : null;

  // Get autocomplete suggestions with fetched values
  const suggestions = showAutocomplete
    ? getAutocompleteSuggestions(inputValue, {
        servers: serversData?.servers.map((s) => s.name) ?? [],
        clients: clientsData?.clients.map((c) => c.clientName) ?? [],
        methods: methodsData?.methods.map((m) => m.method) ?? [],
        sessions: [
          ...new Set(sessionsData?.sessions.map((s) => s.sessionId) ?? []),
        ], // Dedupe session IDs
      })
    : [];

  // Parse input for preview
  const parseResult = trimmed ? parseInput(trimmed) : null;

  // Create error content for dropdown (using design tokens)
  // Only show error when there are NO suggestions (suggestions = user making progress)
  const errorContent =
    error && suggestions.length === 0 ? (
      <div
        className={cn(
          "px-3 py-2.5 border-b border-border",
          "bg-badge-error", // Light red background from design tokens
          "flex items-start gap-2",
        )}
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="size-4 text-status-error shrink-0 mt-0.5" />
        <p className="text-sm text-status-error">{formatErrorMessage(error)}</p>
      </div>
    ) : undefined;

  // Create preview content for dropdown (only for filters, using design tokens)
  const previewContent =
    !error && isValid && parseResult?.type === "filter" ? (
      <output
        className={cn(
          "px-3 py-2 border-b border-border",
          "bg-muted", // Subtle gray from design tokens
          "flex items-center gap-2",
        )}
        aria-live="polite"
      >
        <span className="text-xs text-muted-foreground">Preview:</span>
        <FilterBadge
          filter={createFilter(parseResult.filter)}
          onRemove={() => {}} // No-op for preview
        />
      </output>
    ) : undefined;

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
    if (e.key === "Enter" && isValid) {
      // Enter always submits the typed value (Tab selects suggestions)
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
    // Cancel any pending blur timeout
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    // Check if this suggestion completes a valid filter
    const trimmed = suggestion.text.trim();
    const result = parseInput(trimmed);

    if (result && result.type === "filter") {
      // Complete filter! Add it immediately
      const filter = createFilter(result.filter);
      onAddFilter(filter);
      setInputValue("");
      setShowAutocomplete(false);
      // Don't refocus - let user see the filter pill that was added
    } else {
      // Not complete yet, populate and keep autocomplete open for next stage
      setInputValue(suggestion.text);
      setShowAutocomplete(true);
      inputRef.current?.focus();
    }
  });

  // Validation state for styling
  const validationState = !inputValue.trim()
    ? "empty"
    : isValid
      ? "valid"
      : "invalid";

  return (
    <div>
      {/* Input row */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5",
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
              blurTimeoutRef.current = window.setTimeout(() => {
                setShowAutocomplete(false);
              }, 200);
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

          {/* Add button - only show when valid */}
          {isValid && (
            <Button
              size="sm"
              variant="default"
              onClick={handleAdd}
              className="shrink-0 h-6 leading-1"
            >
              Add
            </Button>
          )}
        </div>

        {/* Unified dropdown with autocomplete + preview + errors */}
        <FilterAutocomplete
          suggestions={suggestions}
          open={showAutocomplete}
          onSelect={handleSelectSuggestion}
          onClose={() => setShowAutocomplete(false)}
          errorContent={errorContent}
          previewContent={previewContent}
        />

        {/* Hidden help text for screen readers */}
        {/* biome-ignore lint/correctness/useUniqueElementIds: Singleton component, static ID is acceptable for ARIA */}
        <span id="command-filter-help" className="sr-only">
          Type a filter like "tokens &gt; 150" or "duration &lt; 25". Use Tab
          for autocomplete, Enter to add, Escape to clear.
        </span>
      </div>
    </div>
  );
}

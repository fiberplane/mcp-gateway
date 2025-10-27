/**
 * SearchInput Component
 *
 * Global search input for filtering logs by content (method names, parameters, etc.)
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812
 *
 * Features:
 * - Debounced input using useDeferredValue (React 19)
 * - Search icon
 * - Clear button (X) when input has value
 * - Updates URL params
 * - Keyboard accessible (Escape to clear)
 * - Screen reader friendly with ARIA labels
 */

import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useState } from "react";

interface SearchInputProps {
  /**
   * Current search value
   */
  value: string;

  /**
   * Callback when search value changes (debounced)
   */
  onChange: (value: string) => void;

  /**
   * Placeholder text
   */
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search logs...",
}: SearchInputProps) {
  // Generate unique ID for accessibility
  const inputId = useId();

  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(value);

  // Debounced value using React 19's useDeferredValue
  const deferredValue = useDeferredValue(localValue);

  // Sync external value changes (e.g., from URL or clear all)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Notify parent of debounced changes
  useEffect(() => {
    if (deferredValue !== value) {
      onChange(deferredValue);
    }
  }, [deferredValue, value, onChange]);

  const handleClear = () => {
    setLocalValue("");
    // Focus back to input after clearing
    document.getElementById(inputId)?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && localValue) {
      e.preventDefault();
      handleClear();
    }
  };

  const hasValue = localValue.trim().length > 0;

  return (
    <div className="relative flex items-center">
      {/* Search icon */}
      <Search
        className="absolute left-3 size-4 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />

      {/* Input field */}
      <input
        id={inputId}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-9 w-64 pl-9 pr-9 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Search logs"
      />

      {/* Clear button (only shown when input has value) */}
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 inline-flex items-center justify-center rounded-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 p-0.5 transition-colors"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

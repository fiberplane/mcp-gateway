/**
 * SearchInput Component
 *
 * Global search input for filtering logs by content.
 *
 * Features:
 * - Debounced input using useDeferredValue
 * - Clear button when input has value
 * - Keyboard hint showing "Escape" to clear
 * - Screen reader friendly with ARIA labels
 */

import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ClearButton } from "./ui/clear-button";
import { InputWithIcon } from "./ui/input-with-icon";
import { Kbd } from "./ui/kbd";

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

  /**
   * Optional className for the container div
   */
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search logs...",
  className,
}: SearchInputProps) {
  // Generate unique ID for accessibility
  const inputId = useId();

  // Ref for type-safe focus management
  const inputRef = useRef<HTMLInputElement>(null);

  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(value);

  // Debounced value using React 19's useDeferredValue
  const deferredValue = useDeferredValue(localValue);

  // Sync external value changes (e.g., from URL or clear all)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Stable reference to onChange to prevent effect re-runs
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Notify parent of debounced changes
  useEffect(() => {
    if (deferredValue !== value) {
      onChangeRef.current(deferredValue);
    }
  }, [deferredValue, value]);

  const handleClear = () => {
    setLocalValue("");
    // Type-safe focus restoration using ref
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && localValue) {
      e.preventDefault();
      handleClear();
    }
  };

  const hasValue = localValue.trim().length > 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <InputWithIcon
        ref={inputRef}
        id={inputId}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search logs"
        leftIcon={Search}
        rightAction={
          hasValue ? (
            <ClearButton
              size="icon-sm"
              onClear={handleClear}
              aria-label="Clear search"
            />
          ) : null
        }
      />
      {hasValue && (
        <p className="text-xs text-muted-foreground">
          Press <Kbd>Escape</Kbd> to clear
        </p>
      )}
    </div>
  );
}

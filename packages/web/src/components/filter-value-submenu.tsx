/**
 * FilterValueSubmenu Component
 *
 * Reusable submenu for selecting filter values with checkboxes.
 * Used by FilterTypeMenu for Method, Client, Server, and Session filters.
 *
 * Features:
 * - Multi-select with checkboxes
 * - Search/filter input
 * - Loading states
 * - Value counts (e.g., "tools/call (42)")
 * - Optional color badges for methods
 * - Keyboard accessible
 * - Screen reader friendly
 */

import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getMethodColor } from "../lib/method-colors";
import { Checkbox } from "./ui/checkbox";
import * as DropdownMenu from "./ui/dropdown-menu";
import { EmptyState } from "./ui/empty-state";
import { LoadingIndicator } from "./ui/loading-indicator";

interface FilterValue {
  value: string;
  count: number;
  label?: string; // Optional display label (defaults to value)
}

interface FilterValueSubmenuProps {
  /**
   * Filter type label (e.g., "Method", "Client")
   */
  label: string;

  /**
   * Available values to select from
   */
  values: FilterValue[];

  /**
   * Currently selected values
   */
  selectedValues: string[];

  /**
   * Callback when selection changes
   */
  onSelectionChange: (values: string[]) => void;

  /**
   * Whether data is loading
   */
  isLoading?: boolean;

  /**
   * Whether to show color badges (for methods)
   */
  showColorBadges?: boolean;

  /**
   * Placeholder for search input
   */
  searchPlaceholder?: string;
}

export function FilterValueSubmenu({
  label,
  values,
  selectedValues,
  onSelectionChange,
  isLoading = false,
  showColorBadges = false,
  searchPlaceholder = "Search...",
}: FilterValueSubmenuProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter values based on search query
  const filteredValues = useMemo(() => {
    if (!searchQuery.trim()) return values;

    const query = searchQuery.toLowerCase();
    return values.filter((item) => {
      const searchText = item.label || item.value;
      return searchText.toLowerCase().includes(query);
    });
  }, [values, searchQuery]);

  const handleToggle = (value: string) => {
    const isSelected = selectedValues.includes(value);

    if (isSelected) {
      // Remove from selection
      onSelectionChange(selectedValues.filter((v) => v !== value));
    } else {
      // Add to selection
      onSelectionChange([...selectedValues, value]);
    }
  };

  const handleClearAll = () => {
    onSelectionChange([]);
    setSearchQuery("");
  };

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>
        <span>{label}</span>
        <ChevronRight className="size-4 ml-auto" aria-hidden="true" />
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent>
          {/* Search Input */}
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1 border-b border-border">
            <Search
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </div>

          {/* Clear All Button */}
          {selectedValues.length > 0 && (
            <DropdownMenu.Item
              className="text-muted-foreground"
              onSelect={handleClearAll}
            >
              Clear all ({selectedValues.length})
            </DropdownMenu.Item>
          )}

          {/* Loading State */}
          {isLoading && <LoadingIndicator />}

          {/* Empty State */}
          {!isLoading && filteredValues.length === 0 && (
            <EmptyState
              icon={Search}
              message={searchQuery ? "No results found" : "No values available"}
            />
          )}

          {/* Value List */}
          {!isLoading && filteredValues.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto">
              {filteredValues.map((item) => {
                const isChecked = selectedValues.includes(item.value);
                const displayLabel = item.label || item.value;

                return (
                  <DropdownMenu.CheckboxItem
                    key={item.value}
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(item.value)}
                    onSelect={(e) => e.preventDefault()} // Prevent menu from closing
                  >
                    {/* Checkbox */}
                    <Checkbox checked={isChecked} />

                    {/* Color Badge (for methods) */}
                    {showColorBadges && (
                      <span
                        className="size-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getMethodColor(item.value) }}
                        aria-hidden="true"
                      />
                    )}

                    {/* Label and Count */}
                    <span className="flex-1 truncate">{displayLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.count}
                    </span>
                  </DropdownMenu.CheckboxItem>
                );
              })}
            </div>
          )}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}

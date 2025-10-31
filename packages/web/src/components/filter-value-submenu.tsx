/**
 * Reusable submenu for multi-selecting filter values.
 * Includes search input and checkboxes.
 */

import { ChevronRight, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { getMethodColor } from "../lib/method-colors";
import { Checkbox } from "./ui/checkbox";
import { ColorPill } from "./ui/color-pill";
import * as DropdownMenu from "./ui/dropdown-menu";
import { EmptyState } from "./ui/empty-state";
import { LoadingIndicator } from "./ui/loading-indicator";

interface FilterValue {
  value: string;
  label?: string; // Optional display label (defaults to value)
}

interface FilterValueSubmenuProps {
  /**
   * Filter type label (e.g., "Method", "Client")
   */
  label: string;

  /**
   * Optional icon to display before label
   */
  icon?: ReactNode;

  /**
   * Available values to select from
   */
  values: FilterValue[];

  /**
   * Currently selected values
   */
  selectedValues: string[];

  /**
   * Initial operator value (preserves existing filter operator)
   */
  initialOperator?: "is" | "contains";

  /**
   * Callback when selection changes
   * @param values - Selected values
   * @param operator - Selected operator (is or contains)
   */
  onSelectionChange: (values: string[], operator: "is" | "contains") => void;

  /**
   * Whether data is loading
   */
  isLoading?: boolean;

  /**
   * Whether to show color pills (for methods)
   */
  showColorPills?: boolean;

  /**
   * Placeholder for search input
   */
  searchPlaceholder?: string;
}

export function FilterValueSubmenu({
  label,
  icon,
  values,
  selectedValues,
  initialOperator,
  onSelectionChange,
  isLoading = false,
  showColorPills = false,
  searchPlaceholder = "Search...",
}: FilterValueSubmenuProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [operator, setOperator] = useState<"is" | "contains">(
    initialOperator ?? "is",
  );

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
      onSelectionChange(
        selectedValues.filter((v) => v !== value),
        operator,
      );
    } else {
      // Add to selection
      onSelectionChange([...selectedValues, value], operator);
    }
  };

  const handleClearAll = () => {
    onSelectionChange([], operator);
    setSearchQuery("");
  };

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger>
        {icon}
        <span>{label}</span>
        <ChevronRight
          className="size-4 ml-auto text-muted-foreground"
          aria-hidden="true"
        />
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

          {/* Operator Selection */}
          <div className="px-2 py-1.5 mb-1 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">
              Match type
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setOperator("is")}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  operator === "is"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
                aria-label="Exact match"
                title="Exact match - only shows logs where the value matches exactly"
              >
                Exact match
              </button>
              <button
                type="button"
                onClick={() => setOperator("contains")}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  operator === "contains"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
                aria-label="Contains"
                title="Contains - shows logs where the value contains the search term"
              >
                Contains
              </button>
            </div>
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

                    {/* Color Pill (for methods) */}
                    {showColorPills ? (
                      <ColorPill color={getMethodColor(item.value)}>
                        {item.value}
                      </ColorPill>
                    ) : (
                      /* Label */
                      <span className="flex-1 truncate">{displayLabel}</span>
                    )}
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

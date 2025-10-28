/**
 * FilterBar Component (Phase 1-2)
 *
 * Displays active filters and provides filtering controls.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812
 *
 * Phase 1 Features:
 * - Display active filter badges
 * - Client filter selector (temporary UI)
 * - "Clear all" button
 * - URL state persistence
 *
 * Phase 2 Features:
 * - Search input (global search)
 *
 * Future phases will add:
 * - "Add filter" dropdown for all filter types
 * - Better client selector UI
 */

import type { createFilter, FilterState } from "@fiberplane/mcp-gateway-types";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  addOrReplaceFilter,
  parseFilterStateFromUrl,
  removeFilter,
  serializeFilterStateToUrl,
} from "../lib/filter-utils";
import { AddFilterDropdown } from "./add-filter-dropdown";
import { FilterBadge } from "./filter-badge";
import { SearchInput } from "./search-input";

interface FilterBarProps {
  /**
   * Callback when filter state changes
   * Used by parent to apply filters to data
   */
  onChange: (state: FilterState) => void;

  /**
   * Optional action buttons to display on the right side of search row
   * (e.g., StreamingBadge, SettingsMenu, ExportButton)
   */
  actions?: ReactNode;
}

export function FilterBar({ onChange, actions }: FilterBarProps) {
  // Live region announcement for screen readers
  const [announcement, setAnnouncement] = useState("");

  // Parse initial state from URL
  const [filterState, setFilterState] = useState<FilterState>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return parseFilterStateFromUrl(params);
    } catch (error) {
      // Gracefully handle malformed URLs or invalid filter parameters
      if (import.meta.env.DEV) {
        // biome-ignore lint/suspicious/noConsole: Dev-only error logging
        console.warn(
          "Failed to parse filters from URL, using defaults:",
          error,
        );
      }
      return { search: "", filters: [] };
    }
  });

  // Use ref to keep latest onChange without causing effect re-runs
  // This prevents infinite loops if parent doesn't memoize onChange
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync URL when filter state changes
  useEffect(() => {
    const params = serializeFilterStateToUrl(filterState);
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", newUrl);

    // Notify parent of changes using latest callback
    onChangeRef.current(filterState);
  }, [filterState]); // Only depend on filterState, not onChange

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        setFilterState(parseFilterStateFromUrl(params));
      } catch (error) {
        // Gracefully handle malformed URLs during navigation
        if (import.meta.env.DEV) {
          // biome-ignore lint/suspicious/noConsole: Dev-only error logging
          console.warn(
            "Failed to parse filters during navigation, using defaults:",
            error,
          );
        }
        setFilterState({ search: "", filters: [] });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update live region announcement when filters change
  useEffect(() => {
    const count = filterState.filters.length;
    if (count === 0) {
      setAnnouncement("All filters cleared");
    } else if (count === 1) {
      setAnnouncement("1 filter active");
    } else {
      setAnnouncement(`${count} filters active`);
    }
  }, [filterState.filters.length]);

  const handleRemoveFilter = (filterId: string) => {
    setFilterState((prev) => ({
      ...prev,
      filters: removeFilter(prev.filters, filterId),
    }));
  };

  const handleAddFilter = (filter: ReturnType<typeof createFilter>) => {
    setFilterState((prev) => ({
      ...prev,
      filters: addOrReplaceFilter(prev.filters, filter),
    }));
  };

  const handleRemoveFilterByField = (field: string) => {
    setFilterState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.field !== field),
    }));
  };

  const handleSearchChange = (search: string) => {
    setFilterState((prev) => ({
      ...prev,
      search,
    }));
  };

  const handleClearAll = () => {
    // Only clear filters, preserve search (UX principle: button position = button scope)
    setFilterState((prev) => ({
      ...prev,
      filters: [],
    }));
  };

  // Show "Clear all" button only when there are active filters
  // (not when search has text - search is cleared via its own X button)
  const hasActiveFilters = filterState.filters.length > 0;

  return (
    <>
      {/* Visually hidden live region for screen reader announcements */}
      {/* biome-ignore lint/a11y/useSemanticElements: div with role="status" is the correct ARIA pattern for live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div className="flex flex-col gap-3">
        {/* Row 1: Search input + Action buttons */}
        <div className="flex items-center gap-3">
          <SearchInput
            value={filterState.search}
            onChange={handleSearchChange}
            placeholder="Search logs..."
            className="flex-1"
          />
          {actions}
        </div>

        {/* Row 2: Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add filter button - always first for stable position */}
          <AddFilterDropdown
            onAdd={handleAddFilter}
            onRemove={handleRemoveFilterByField}
            activeFilters={filterState.filters}
          />

          {/* Active filter badges */}
          {filterState.filters.map((filter) => (
            <FilterBadge
              key={filter.id}
              filter={filter}
              onRemove={handleRemoveFilter}
            />
          ))}

          {/* Clear all button - positioned right after filter badges */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </>
  );
}

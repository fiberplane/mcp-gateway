/**
 * Filter bar with unified input, active search terms, filter badges, and controls.
 * Filter state is synced with URL parameters via nuqs.
 *
 * Implements presenter/container pattern:
 * - FilterBarUI (below): Pure presentation component, easy to test
 * - FilterBar (export): Container with URL state management
 */

import type { createFilter } from "@fiberplane/mcp-gateway-types";
import { useQueryState, useQueryStates } from "nuqs";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { formatFilterForEditing } from "@/lib/filter-parser";
import {
  filterParamsToFilters,
  filtersToFilterParams,
  parseAsFilterParam,
  parseAsSearchArray,
} from "../lib/filter-parsers";
import { addOrReplaceFilter, removeFilter } from "../lib/filter-utils";
import { AddFilterDropdown } from "./add-filter-dropdown";
import { CommandFilterInput } from "./command-filter-input";
import { FilterBadge } from "./filter-badge";

interface FilterBarProps {
  /**
   * Optional action buttons to display on the right side of search row
   * (e.g., StreamingBadge, SettingsMenu, ExportButton)
   */
  actions?: ReactNode;
}

/**
 * FilterBarUI - Pure presentation component (Presenter)
 * Receives all state and callbacks as props, making it easy to test
 */
export interface FilterBarUIProps {
  filters: ReturnType<typeof createFilter>[];
  searchValue: string;
  announcement: string;
  editingValue: string | undefined;
  hasActiveItems: boolean;
  searchQueryCount: number;
  onAddFilter: (filter: ReturnType<typeof createFilter>) => void;
  onUpdateSearch: (value: string) => void;
  onRemoveFilter: (filterId: string) => void;
  onEditFilter: (filterId: string) => void;
  onCancelEdit: () => void;
  onClearAll: () => void;
  onRemoveFilterByField: (field: string) => void;
  actions?: ReactNode;
}

export function FilterBarUI({
  filters,
  searchValue,
  announcement,
  editingValue,
  hasActiveItems,
  searchQueryCount,
  onAddFilter,
  onUpdateSearch,
  onRemoveFilter,
  onEditFilter,
  onCancelEdit,
  onClearAll,
  onRemoveFilterByField,
  actions,
}: FilterBarUIProps) {
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

      <div className="flex flex-col gap-2">
        {/* Row 1: Unified input + Action buttons */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <CommandFilterInput
              onAddFilter={onAddFilter}
              searchValue={searchValue}
              onUpdateSearch={onUpdateSearch}
              initialValue={editingValue}
              onCancel={onCancelEdit}
            />
          </div>
          {actions}
        </div>

        {/* Row 2: Search pills + Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add filter button - always first for stable position */}
          <AddFilterDropdown
            onAdd={onAddFilter}
            onRemove={onRemoveFilterByField}
            activeFilters={filters}
          />

          {/* Active filter badges */}
          {filters.map((filter) => (
            <FilterBadge
              key={filter.id}
              filter={filter}
              onRemove={onRemoveFilter}
              onEdit={onEditFilter}
            />
          ))}

          {/* Clear all button - positioned right after pills */}
          {hasActiveItems && (
            <button
              type="button"
              onClick={onClearAll}
              aria-label={`Clear all ${filters.length} filter${filters.length === 1 ? "" : "s"}${searchQueryCount > 0 ? ` and ${searchQueryCount} search term${searchQueryCount === 1 ? "" : "s"}` : ""}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * FilterBar - Container component with URL state management (Container)
 * Wraps FilterBarUI and provides state from nuqs hooks
 */

export function FilterBar({ actions }: FilterBarProps) {
  // Live region announcement for screen readers
  const [announcement, setAnnouncement] = useState("");

  // State for editing filters
  const [editingValue, setEditingValue] = useState<string | undefined>();
  const [editingFilter, setEditingFilter] = useState<
    ReturnType<typeof createFilter> | undefined
  >();

  // URL state management via nuqs
  // Search terms stored as comma-separated in URL: ?search=error,warning
  const [searchQueries, setSearchQueries] = useQueryState(
    "search",
    parseAsSearchArray,
  );

  // Convert search queries array to space-separated string for input
  const searchValue = useMemo(() => searchQueries.join(" "), [searchQueries]);

  const [filterParams, setFilterParams] = useQueryStates(
    {
      client: parseAsFilterParam,
      method: parseAsFilterParam,
      session: parseAsFilterParam,
      server: parseAsFilterParam,
      duration: parseAsFilterParam,
      tokens: parseAsFilterParam,
    },
    {
      history: "replace", // Use replaceState instead of pushState
    },
  );

  // Convert URL params to Filter array
  const filters = useMemo(
    () => filterParamsToFilters(filterParams),
    [filterParams],
  );

  // Update live region announcement when filters change
  useEffect(() => {
    const count = filters.length;
    if (count === 0) {
      setAnnouncement("All filters cleared");
    } else if (count === 1) {
      setAnnouncement("1 filter active");
    } else {
      setAnnouncement(`${count} filters active`);
    }
  }, [filters.length]);

  const handleRemoveFilter = (filterId: string) => {
    const updatedFilters = removeFilter(filters, filterId);
    const newParams = filtersToFilterParams(updatedFilters);
    setFilterParams(newParams);
  };

  const handleAddFilter = (filter: ReturnType<typeof createFilter>) => {
    const updatedFilters = addOrReplaceFilter(filters, filter);
    const newParams = filtersToFilterParams(updatedFilters);
    setFilterParams(newParams);
    // Clear editing state
    setEditingValue(undefined);
    setEditingFilter(undefined);
  };

  const handleRemoveFilterByField = (field: string) => {
    const updatedFilters = filters.filter((f) => f.field !== field);
    const newParams = filtersToFilterParams(updatedFilters);
    setFilterParams(newParams);
  };

  const handleUpdateSearch = (newSearchValue: string) => {
    // Convert space-separated string to array for URL
    const trimmed = newSearchValue.trim();
    if (!trimmed) {
      setSearchQueries([]);
      return;
    }
    // Split by spaces and filter out empty strings
    const terms = trimmed.split(/\s+/).filter((t) => t.length > 0);
    setSearchQueries(terms);
  };

  const handleEditFilter = (filterId: string) => {
    // Don't allow editing if already editing something
    if (editingValue !== undefined) return;

    // Find the filter being edited
    const filter = filters.find((f) => f.id === filterId);
    if (!filter) return;

    // Store original filter for restoration on cancel
    setEditingFilter(filter);

    // Format filter as text for editing
    const text = formatFilterForEditing(filter);
    setEditingValue(text);

    // Remove the filter (it will be re-added when user submits or cancelled)
    handleRemoveFilter(filterId);
  };

  const handleCancelEdit = () => {
    // Restore original filter if editing was cancelled
    if (editingFilter) {
      const updatedFilters = addOrReplaceFilter(filters, editingFilter);
      const newParams = filtersToFilterParams(updatedFilters);
      setFilterParams(newParams);
    }
    // Clear editing state
    setEditingValue(undefined);
    setEditingFilter(undefined);
  };

  const handleClearAll = () => {
    // Clear both filters and search terms
    setFilterParams({
      client: null,
      method: null,
      session: null,
      server: null,
      duration: null,
      tokens: null,
    });
    setSearchQueries([]);
  };

  // Show "Clear all" button when there are active filters or search terms
  const hasActiveItems = filters.length > 0 || searchValue.length > 0;

  return (
    <FilterBarUI
      filters={filters}
      searchValue={searchValue}
      announcement={announcement}
      editingValue={editingValue}
      hasActiveItems={hasActiveItems}
      searchQueryCount={searchQueries.length}
      onAddFilter={handleAddFilter}
      onUpdateSearch={handleUpdateSearch}
      onRemoveFilter={handleRemoveFilter}
      onEditFilter={handleEditFilter}
      onCancelEdit={handleCancelEdit}
      onClearAll={handleClearAll}
      onRemoveFilterByField={handleRemoveFilterByField}
      actions={actions}
    />
  );
}

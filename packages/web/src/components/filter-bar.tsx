/**
 * Filter bar with unified input, active search terms, filter badges, and controls.
 * Filter state is synced with URL parameters via nuqs.
 */

import type {
  createFilter,
  createSearchTerm,
  SearchTerm,
} from "@fiberplane/mcp-gateway-types";
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
import { SearchPill } from "./search-pill";

interface FilterBarProps {
  /**
   * Optional action buttons to display on the right side of search row
   * (e.g., StreamingBadge, SettingsMenu, ExportButton)
   */
  actions?: ReactNode;
}

export function FilterBar({ actions }: FilterBarProps) {
  // Live region announcement for screen readers
  const [announcement, setAnnouncement] = useState("");

  // State for editing filters
  const [editingValue, setEditingValue] = useState<string | undefined>();

  // URL state management via nuqs
  // Search terms stored as comma-separated in URL: ?search=error,warning
  const [searchQueries, setSearchQueries] = useQueryState(
    "search",
    parseAsSearchArray,
  );

  // Convert search queries to SearchTerm objects with IDs
  const searchTerms = useMemo<SearchTerm[]>(
    () =>
      searchQueries.map((query, index) => ({
        id: `search-${index}`,
        query,
      })),
    [searchQueries],
  );

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
  };

  const handleRemoveFilterByField = (field: string) => {
    const updatedFilters = filters.filter((f) => f.field !== field);
    const newParams = filtersToFilterParams(updatedFilters);
    setFilterParams(newParams);
  };

  const handleAddSearch = (searchTerm: ReturnType<typeof createSearchTerm>) => {
    setSearchQueries([...searchQueries, searchTerm.query]);
    setEditingValue(undefined); // Clear editing state
  };

  const handleRemoveSearch = (searchTermId: string) => {
    // Extract index from ID (format: "search-0", "search-1", etc.)
    const index = Number.parseInt(searchTermId.split("-")[1] || "0", 10);
    const updated = searchQueries.filter((_, i) => i !== index);
    setSearchQueries(updated);
  };

  const handleEditFilter = (filterId: string) => {
    // Find the filter being edited
    const filter = filters.find((f) => f.id === filterId);
    if (!filter) return;

    // Format filter as text for editing
    const text = formatFilterForEditing(filter);
    setEditingValue(text);

    // Remove the filter (it will be re-added when user submits)
    handleRemoveFilter(filterId);
  };

  const handleEditSearch = (searchTermId: string) => {
    // Extract index and get the search term
    const index = Number.parseInt(searchTermId.split("-")[1] || "0", 10);
    const query = searchQueries[index];
    if (!query) return;

    // Populate input with search term
    setEditingValue(query);

    // Remove the search term (it will be re-added when user submits)
    handleRemoveSearch(searchTermId);
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
  const hasActiveItems = filters.length > 0 || searchTerms.length > 0;

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
        {/* Row 1: Unified input + Action buttons */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <CommandFilterInput
              onAddFilter={handleAddFilter}
              onAddSearch={handleAddSearch}
              initialValue={editingValue}
            />
          </div>
          {actions}
        </div>

        {/* Row 2: Search pills + Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Add filter button - always first for stable position */}
          <AddFilterDropdown
            onAdd={handleAddFilter}
            onRemove={handleRemoveFilterByField}
            activeFilters={filters}
          />

          {/* Active search pills */}
          {searchTerms.map((searchTerm) => (
            <SearchPill
              key={searchTerm.id}
              searchTerm={searchTerm}
              onRemove={handleRemoveSearch}
              onEdit={handleEditSearch}
            />
          ))}

          {/* Active filter badges */}
          {filters.map((filter) => (
            <FilterBadge
              key={filter.id}
              filter={filter}
              onRemove={handleRemoveFilter}
              onEdit={handleEditFilter}
            />
          ))}

          {/* Clear all button - positioned right after pills */}
          {hasActiveItems && (
            <button
              type="button"
              onClick={handleClearAll}
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

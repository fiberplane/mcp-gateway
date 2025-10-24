/**
 * FilterBar Component (Phase 1)
 *
 * Displays active filters and provides basic filtering controls.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812
 *
 * Phase 1 Features:
 * - Display active filter badges
 * - Client filter selector (temporary UI)
 * - "Clear all" button
 * - URL state persistence
 *
 * Future phases will add:
 * - Search input
 * - "Add filter" dropdown for all filter types
 * - Better client selector UI
 */

import { createFilter, type FilterState } from "@fiberplane/mcp-gateway-types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  parseFilterStateFromUrl,
  removeFilter,
  serializeFilterStateToUrl,
} from "../lib/filter-utils";
import { FilterBadge } from "./filter-badge";
import { Button } from "./ui/button";

interface FilterBarProps {
  /**
   * Callback when filter state changes
   * Used by parent to apply filters to data
   */
  onChange: (state: FilterState) => void;
}

export function FilterBar({ onChange }: FilterBarProps) {
  // Generate unique ID for accessibility
  const clientSelectId = useId();

  // Parse initial state from URL
  const [filterState, setFilterState] = useState<FilterState>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return parseFilterStateFromUrl(params);
    } catch (error) {
      // Gracefully handle malformed URLs or invalid filter parameters
      // biome-ignore lint/suspicious/noConsole: Error logging for debugging
      console.warn("Failed to parse filters from URL, using defaults:", error);
      return { search: "", filters: [] };
    }
  });

  // Fetch available clients for the dropdown
  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: () => api.getClients(),
    refetchInterval: 5000,
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
        // biome-ignore lint/suspicious/noConsole: Error logging for debugging
        console.warn(
          "Failed to parse filters during navigation, using defaults:",
          error,
        );
        setFilterState({ search: "", filters: [] });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Get current client filter value (if any)
  const clientFilter = filterState.filters.find((f) => f.field === "client");
  const clientValue = clientFilter?.value as string | undefined;

  const handleClientChange = (value: string) => {
    if (value === "all") {
      // Remove client filter
      setFilterState((prev) => ({
        ...prev,
        filters: prev.filters.filter((f) => f.field !== "client"),
      }));
    } else {
      // Add or replace client filter
      const newFilter = createFilter({
        field: "client" as const,
        operator: "is" as const,
        value,
      });

      setFilterState((prev) => ({
        ...prev,
        filters: [
          ...prev.filters.filter((f) => f.field !== "client"),
          newFilter,
        ],
      }));
    }
  };

  const handleRemoveFilter = (filterId: string) => {
    setFilterState((prev) => ({
      ...prev,
      filters: removeFilter(prev.filters, filterId),
    }));
  };

  const handleClearAll = () => {
    setFilterState({
      search: "",
      filters: [],
    });
  };

  const hasActiveFilters =
    filterState.filters.length > 0 || filterState.search.trim().length > 0;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Phase 1: Simple client selector (temporary) */}
      <div className="flex items-center gap-2">
        <label
          htmlFor={clientSelectId}
          className="text-sm font-medium text-muted-foreground"
        >
          Client:
        </label>
        <select
          id={clientSelectId}
          value={clientValue || "all"}
          onChange={(e) => handleClientChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="all">All clients</option>
          {clientsData?.clients.map((client) => (
            <option key={client.clientName} value={client.clientName}>
              {client.clientName} ({client.logCount})
            </option>
          ))}
        </select>
      </div>

      {/* Active filter badges */}
      {filterState.filters.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {filterState.filters.map((filter) => (
            <FilterBadge
              key={filter.id}
              filter={filter}
              onRemove={handleRemoveFilter}
            />
          ))}
        </div>
      )}

      {/* Clear all button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="ml-auto"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

/**
 * Filter utilities for URL serialization and client-side filtering
 *
 * These pure functions handle:
 * - Converting filters to/from URL search params
 * - Applying filters to log data client-side
 * - Filter matching logic
 */

import type { ApiLogEntry } from "@fiberplane/mcp-gateway-types";
import {
  type Filter,
  type FilterField,
  type FilterState,
  isDurationFilter,
  safeParseFilter,
} from "@fiberplane/mcp-gateway-types";

// ============================================================================
// URL Serialization
// ============================================================================

/**
 * Parse filters from URL search params
 *
 * URL format: ?client=value&method=value&q=search
 * Each filter field can appear once with format: field=operator:value
 *
 * @example
 * parseFiltersFromUrl(new URLSearchParams("?client=is:claude-code&duration=gt:100"))
 * // Returns: [{ field: "client", operator: "is", value: "claude-code" }, ...]
 */
export function parseFiltersFromUrl(params: URLSearchParams): Filter[] {
  const filters: Filter[] = [];

  const fieldKeys: FilterField[] = [
    "client",
    "method",
    "session",
    "server",
    "duration",
    "tokens",
  ];

  for (const field of fieldKeys) {
    const param = params.get(field);
    if (!param) continue;

    // Parse format: "operator:value"
    const colonIndex = param.indexOf(":");
    if (colonIndex === -1) continue;

    const operator = param.slice(0, colonIndex);
    const valueStr = param.slice(colonIndex + 1);

    // Parse value based on field type
    let value: string | number = valueStr;
    if (field === "duration" || field === "tokens") {
      const numValue = Number.parseInt(valueStr, 10);
      if (Number.isNaN(numValue)) continue; // Skip invalid numbers
      value = numValue;
    }

    // Create filter with validation
    const filterInput = { field, operator, value };
    const result = safeParseFilter({
      id: crypto.randomUUID(),
      ...filterInput,
    });

    if (result.success) {
      filters.push(result.data);
    }
    // Silently skip invalid filters from URL
  }

  return filters;
}

/**
 * Serialize filters to URL search params
 *
 * @example
 * serializeFiltersToUrl([
 *   { field: "client", operator: "is", value: "claude-code" }
 * ], "echo")
 * // Returns URLSearchParams: "client=is:claude-code&q=echo"
 */
export function serializeFiltersToUrl(
  filters: Filter[],
  search?: string,
): URLSearchParams {
  const params = new URLSearchParams();

  // Add search query if present
  if (search?.trim()) {
    params.set("q", search.trim());
  }

  // Add each filter as field=operator:value
  for (const filter of filters) {
    params.set(filter.field, `${filter.operator}:${filter.value}`);
  }

  return params;
}

/**
 * Parse filter state (search + filters) from URL
 */
export function parseFilterStateFromUrl(params: URLSearchParams): FilterState {
  const search = params.get("q") || "";
  const filters = parseFiltersFromUrl(params);
  return { search, filters };
}

/**
 * Serialize filter state to URL
 */
export function serializeFilterStateToUrl(state: FilterState): URLSearchParams {
  return serializeFiltersToUrl(state.filters, state.search);
}

// ============================================================================
// Filter Matching
// ============================================================================

/**
 * Check if a log entry matches a single filter
 *
 * @example
 * matchesFilter(log, { field: "client", operator: "is", value: "claude-code" })
 * // Returns: true if log.metadata.client.name === "claude-code"
 */
export function matchesFilter(log: ApiLogEntry, filter: Filter): boolean {
  switch (filter.field) {
    case "client":
      return matchesStringFilter(
        log.metadata.client?.name,
        filter.operator,
        filter.value,
      );

    case "method":
      return matchesStringFilter(log.method, filter.operator, filter.value);

    case "session":
      return matchesStringFilter(
        log.metadata.sessionId,
        filter.operator,
        filter.value,
      );

    case "server":
      return matchesStringFilter(
        log.metadata.server?.name,
        filter.operator,
        filter.value,
      );

    case "duration":
      return matchesNumericFilter(
        log.metadata.durationMs,
        filter.operator,
        filter.value,
      );

    case "tokens":
      // Note: tokens field doesn't exist yet in ApiLogEntry
      // This is a placeholder for future implementation
      return true;

    default:
      // Exhaustiveness check - TypeScript will error if we miss a case
      return false;
  }
}

/**
 * Match string value against string filter
 */
function matchesStringFilter(
  value: string | undefined,
  operator: "is" | "contains",
  filterValue: string,
): boolean {
  if (!value) return false;

  switch (operator) {
    case "is":
      return value === filterValue;
    case "contains":
      return value.toLowerCase().includes(filterValue.toLowerCase());
    default:
      return false;
  }
}

/**
 * Match numeric value against numeric filter
 */
function matchesNumericFilter(
  value: number | undefined,
  operator: "eq" | "gt" | "lt" | "gte" | "lte",
  filterValue: number,
): boolean {
  if (value === undefined) return false;

  switch (operator) {
    case "eq":
      return value === filterValue;
    case "gt":
      return value > filterValue;
    case "lt":
      return value < filterValue;
    case "gte":
      return value >= filterValue;
    case "lte":
      return value <= filterValue;
    default:
      return false;
  }
}

/**
 * Check if a log entry matches the search query
 *
 * Searches across: method, client name, server name, session ID
 */
export function matchesSearch(log: ApiLogEntry, search: string): boolean {
  if (!search.trim()) return true;

  const query = search.toLowerCase();
  const searchableFields = [
    log.method,
    log.metadata.client?.name,
    log.metadata.server?.name,
    log.metadata.sessionId,
  ];

  return searchableFields.some((field) => field?.toLowerCase().includes(query));
}

// ============================================================================
// Batch Filtering
// ============================================================================

/**
 * Apply all filters and search to a list of logs
 *
 * Returns logs that match ALL filters (AND logic) and the search query
 *
 * @example
 * applyFiltersToLogs(logs, [
 *   { field: "client", operator: "is", value: "claude-code" },
 *   { field: "duration", operator: "gt", value: 100 }
 * ], "echo")
 * // Returns: logs where client is "claude-code" AND duration > 100 AND contains "echo"
 */
export function applyFiltersToLogs(
  logs: ApiLogEntry[],
  filters: Filter[],
  search?: string,
): ApiLogEntry[] {
  return logs.filter((log) => {
    // Must match ALL filters
    for (const filter of filters) {
      if (!matchesFilter(log, filter)) {
        return false;
      }
    }

    // Must match search if present
    if (search && !matchesSearch(log, search)) {
      return false;
    }

    return true;
  });
}

/**
 * Apply filter state to logs
 */
export function applyFilterState(
  logs: ApiLogEntry[],
  state: FilterState,
): ApiLogEntry[] {
  return applyFiltersToLogs(logs, state.filters, state.search);
}

// ============================================================================
// Filter Helpers
// ============================================================================

/**
 * Get a display label for a filter
 *
 * @example
 * getFilterLabel({ field: "client", operator: "is", value: "claude-code" })
 * // Returns: "Client is claude-code"
 */
export function getFilterLabel(filter: Filter): string {
  const fieldLabels: Record<FilterField, string> = {
    client: "Client",
    method: "Method",
    session: "Session",
    server: "Server",
    duration: "Duration",
    tokens: "Tokens",
  };

  const operatorLabels: Record<string, string> = {
    is: "is",
    contains: "contains",
    eq: "equals",
    gt: "greater than",
    lt: "less than",
    gte: "≥",
    lte: "≤",
  };

  const field = fieldLabels[filter.field];
  const operator = operatorLabels[filter.operator] || filter.operator;
  let value = String(filter.value);

  // Add units for duration
  if (isDurationFilter(filter)) {
    value = `${filter.value}ms`;
  }

  return `${field} ${operator} ${value}`;
}

/**
 * Check if two filters are equal
 */
export function areFiltersEqual(a: Filter, b: Filter): boolean {
  return (
    a.field === b.field &&
    a.operator === b.operator &&
    a.value === b.value &&
    a.id === b.id
  );
}

/**
 * Remove a filter by ID
 */
export function removeFilter(filters: Filter[], id: string): Filter[] {
  return filters.filter((f) => f.id !== id);
}

/**
 * Add a filter (avoiding duplicates by field)
 *
 * If a filter for the same field already exists, replace it.
 * Otherwise, add the new filter.
 */
export function addOrReplaceFilter(
  filters: Filter[],
  newFilter: Filter,
): Filter[] {
  const existingIndex = filters.findIndex((f) => f.field === newFilter.field);

  if (existingIndex >= 0) {
    // Replace existing filter
    const updated = [...filters];
    updated[existingIndex] = newFilter;
    return updated;
  }

  // Add new filter
  return [...filters, newFilter];
}

/**
 * Clear all filters
 */
export function clearAllFilters(): Filter[] {
  return [];
}

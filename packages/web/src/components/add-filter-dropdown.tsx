/**
 * AddFilterDropdown Component
 *
 * Cascading menu for adding new filters to the filter bar.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-3266
 *
 * Features:
 * - Cascading menu with data-driven submenus
 * - Multi-select support (checkboxes)
 * - Search/filter within submenus
 * - Keyboard accessible
 * - Screen reader friendly with ARIA labels
 * - Real-time data from backend
 */

import {
  createFilter,
  type Filter,
  type FilterField,
} from "@fiberplane/mcp-gateway-types";
import { FilterTypeMenu } from "./filter-type-menu";

interface AddFilterDropdownProps {
  /**
   * Callback when new filters are added
   */
  onAdd: (filter: Filter) => void;

  /**
   * Callback when filters are removed
   */
  onRemove?: (field: string) => void;

  /**
   * Currently active filters (optional)
   * Used to show selection state in the menu
   */
  activeFilters?: Filter[];
}

export function AddFilterDropdown({
  onAdd,
  onRemove,
  activeFilters = [],
}: AddFilterDropdownProps) {
  /**
   * Convert active filters to the format expected by FilterTypeMenu
   */
  const getActiveFilterValues = () => {
    const result: {
      method?: string[];
      client?: string[];
      server?: string[];
      session?: string[];
    } = {};

    for (const filter of activeFilters) {
      const field = filter.field as FilterField;

      // Only handle string filters for now (method, client, server, session)
      if (
        field === "method" ||
        field === "client" ||
        field === "server" ||
        field === "session"
      ) {
        // Get values as array of strings
        const values = Array.isArray(filter.value)
          ? filter.value.map((v) => String(v))
          : [String(filter.value)];

        result[field] = values;
      }
    }

    return result;
  };

  /**
   * Handle filter application from FilterTypeMenu
   * Called for EACH filter type when menu closes
   */
  const handleApply = (filterType: string, values: string[]) => {
    const field = filterType as FilterField;

    if (values.length === 0) {
      // Empty array means remove this filter type
      if (onRemove) {
        onRemove(field);
      }
      return;
    }

    // Create filter with array values for multi-select
    // Use single value if only one selected, otherwise use array
    let filterValue: string | string[];
    if (values.length === 1) {
      // Safe to access first element since we checked length
      filterValue = values[0] as string;
    } else {
      filterValue = values;
    }

    const newFilter = createFilter({
      field,
      operator: "is" as const, // Use "is" for multi-value filters
      value: filterValue,
    });

    onAdd(newFilter);
  };

  return (
    <FilterTypeMenu
      onApply={handleApply}
      activeFilters={getActiveFilterValues()}
    />
  );
}

/**
 * Dropdown menu for adding filters.
 * Converts menu selections to Filter objects via onAdd callback.
 */

import {
  createFilter,
  type Filter,
  filterFieldSchema,
} from "@fiberplane/mcp-gateway-types";
import { useHandler } from "@/lib/use-handler";
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
  const getActiveFilterData = useHandler(() => {
    const values: {
      method?: string[];
      client?: string[];
      server?: string[];
      session?: string[];
    } = {};

    const operators: {
      method?: "is" | "contains";
      client?: "is" | "contains";
      server?: "is" | "contains";
      session?: "is" | "contains";
    } = {};

    for (const filter of activeFilters) {
      // filter.field is already typed as FilterField from discriminated union
      const field = filter.field;

      // Only handle string filters for now (method, client, server, session)
      if (
        field === "method" ||
        field === "client" ||
        field === "server" ||
        field === "session"
      ) {
        // Get values as array of strings
        const filterValues = Array.isArray(filter.value)
          ? filter.value.map((v) => String(v))
          : [String(filter.value)];

        values[field] = filterValues;
        operators[field] = filter.operator;
      }
    }

    return { values, operators };
  });

  /**
   * Handle filter application from FilterTypeMenu
   * Called for EACH filter type when menu closes
   */
  const handleApply = useHandler(
    (filterType: string, values: string[], operator: "is" | "contains") => {
      const fieldResult = filterFieldSchema.safeParse(filterType);
      if (!fieldResult.success) {
        return;
      }

      const field = fieldResult.data;

      if (values.length === 0) {
        // Empty array means remove this filter type
        if (onRemove) {
          onRemove(field);
        }
        return;
      }

      // Create filter with array values for multi-select
      // Use single value if only one selected, otherwise use array
      const filterValue: string | string[] =
        values.length === 1 ? (values[0] ?? "") : values;

      const newFilter = createFilter({
        field,
        operator,
        value: filterValue,
      });

      onAdd(newFilter);
    },
  );

  const { values, operators } = getActiveFilterData();

  return (
    <FilterTypeMenu
      onApply={handleApply}
      activeFilters={values}
      activeOperators={operators}
    />
  );
}

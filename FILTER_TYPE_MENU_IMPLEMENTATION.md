# FilterTypeMenu Implementation Guide

## Complete Code Implementation

### Step 1: Update FilterTypeMenu Component

Replace the current `filter-type-menu.tsx` with this implementation:

```typescript
/**
 * FilterTypeMenu Component
 *
 * Main cascading menu for adding filters.
 * Provides submenus for Method, Session, Client, and Server filters.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-3266
 *
 * Features:
 * - Cascading menu with Radix Dropdown Menu
 * - Data-driven submenus using TanStack Query hooks
 * - Multi-select support (checkboxes)
 * - Search/filter within submenus
 * - Apply on close (no Apply/Cancel buttons)
 * - Keyboard accessible (ESC to cancel)
 * - Screen reader friendly
 */

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useAvailableClients,
  useAvailableMethods,
  useAvailableServers,
  useAvailableSessions,
} from "../lib/use-available-filters";
import { FilterValueSubmenu } from "./filter-value-submenu";
import { Button } from "./ui/button";

interface FilterTypeMenuProps {
  /**
   * Callback when filters are applied (menu closes)
   * @param filterType - The type of filter (method, client, server, session)
   * @param values - Array of selected values (empty array = remove filter)
   */
  onApply: (filterType: string, values: string[]) => void;

  /**
   * Currently active filter values by type
   * Used to show selection counts and checked states
   */
  activeFilters?: {
    method?: string[];
    client?: string[];
    server?: string[];
    session?: string[];
  };
}

export function FilterTypeMenu({
  onApply,
  activeFilters = {},
}: FilterTypeMenuProps) {
  const [open, setOpen] = useState(false);

  // Track selections temporarily (before applying)
  const [selectedMethods, setSelectedMethods] = useState<string[]>(
    activeFilters.method ?? [],
  );
  const [selectedClients, setSelectedClients] = useState<string[]>(
    activeFilters.client ?? [],
  );
  const [selectedServers, setSelectedServers] = useState<string[]>(
    activeFilters.server ?? [],
  );
  const [selectedSessions, setSelectedSessions] = useState<string[]>(
    activeFilters.session ?? [],
  );

  // Fetch available values
  const methodsQuery = useAvailableMethods();
  const clientsQuery = useAvailableClients();
  const serversQuery = useAvailableServers();
  const sessionsQuery = useAvailableSessions();

  // Transform data for FilterValueSubmenu
  const methodValues =
    methodsQuery.data?.methods.map((m) => ({
      value: m.method,
      count: m.logCount,
    })) ?? [];

  const clientValues =
    clientsQuery.data?.clients.map((c) => ({
      value: c.clientName,
      label: c.clientVersion
        ? `${c.clientName} (${c.clientVersion})`
        : c.clientName,
      count: c.logCount,
    })) ?? [];

  const serverValues =
    serversQuery.data?.servers.map((s) => ({
      value: s.name,
      count: s.logCount,
    })) ?? [];

  const sessionValues =
    sessionsQuery.data?.sessions.map((s) => ({
      value: s.sessionId,
      label: `${s.sessionId.slice(0, 8)}... (${s.serverName})`,
      count: s.logCount,
    })) ?? [];

  // Sync temp state with active filters when menu opens
  useEffect(() => {
    if (open) {
      setSelectedMethods(activeFilters.method ?? []);
      setSelectedClients(activeFilters.client ?? []);
      setSelectedServers(activeFilters.server ?? []);
      setSelectedSessions(activeFilters.session ?? []);
    }
  }, [open, activeFilters]);

  // Apply all filter changes when menu closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && open) {
      // Menu is closing - apply all selections
      applyFilters();
    }
    setOpen(newOpen);
  };

  const applyFilters = () => {
    // Apply each filter type with its selected values
    // Empty array = remove filter for that type
    onApply("method", selectedMethods);
    onApply("client", selectedClients);
    onApply("server", selectedServers);
    onApply("session", selectedSessions);
  };

  const discardChanges = () => {
    // Reset temp state to active filters
    setSelectedMethods(activeFilters.method ?? []);
    setSelectedClients(activeFilters.client ?? []);
    setSelectedServers(activeFilters.server ?? []);
    setSelectedSessions(activeFilters.session ?? []);
  };

  // Detect uncommitted changes
  const hasUncommittedChanges =
    JSON.stringify([...selectedMethods].sort()) !==
      JSON.stringify([...(activeFilters.method ?? [])].sort()) ||
    JSON.stringify([...selectedClients].sort()) !==
      JSON.stringify([...(activeFilters.client ?? [])].sort()) ||
    JSON.stringify([...selectedServers].sort()) !==
      JSON.stringify([...(activeFilters.server ?? [])].sort()) ||
    JSON.stringify([...selectedSessions].sort()) !==
      JSON.stringify([...(activeFilters.session ?? [])].sort());

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <Plus className="size-4" aria-hidden="true" />
          Add filter
          {hasUncommittedChanges && (
            <span
              className="absolute -top-1 -right-1 size-2 rounded-full bg-orange-500"
              aria-label="Uncommitted changes"
            />
          )}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-lg"
          sideOffset={5}
          align="start"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              // ESC key - discard changes and close
              discardChanges();
              setOpen(false);
            }
          }}
        >
          {/* Method Filter */}
          <FilterValueSubmenu
            label="Method"
            values={methodValues}
            selectedValues={selectedMethods}
            onSelectionChange={setSelectedMethods}
            isLoading={methodsQuery.isLoading}
            showColorBadges={true}
            searchPlaceholder="Search methods..."
          />

          {/* Session Filter */}
          <FilterValueSubmenu
            label="Session"
            values={sessionValues}
            selectedValues={selectedSessions}
            onSelectionChange={setSelectedSessions}
            isLoading={sessionsQuery.isLoading}
            searchPlaceholder="Search sessions..."
          />

          {/* Client Filter */}
          <FilterValueSubmenu
            label="Client"
            values={clientValues}
            selectedValues={selectedClients}
            onSelectionChange={setSelectedClients}
            isLoading={clientsQuery.isLoading}
            searchPlaceholder="Search clients..."
          />

          {/* Server Filter */}
          <FilterValueSubmenu
            label="Server"
            values={serverValues}
            selectedValues={selectedServers}
            onSelectionChange={setSelectedServers}
            isLoading={serversQuery.isLoading}
            searchPlaceholder="Search servers..."
          />

          {/* Helper text (optional) */}
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-t border-border mt-1">
            Filters apply when menu closes. Press ESC to cancel.
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

### Step 2: Update FilterBar Integration

Update the FilterBar component to handle the new callback pattern:

```typescript
// In FilterBar component, add this handler:
const handleFilterTypeMenuApply = (filterType: string, values: string[]) => {
  if (values.length === 0) {
    // Empty array = remove filter for this type
    setFilterState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.field !== filterType),
    }));
  } else {
    // Add or replace filter with multiple values (OR logic)
    const newFilter = createFilter({
      field: filterType as const,
      operator: "is" as const,
      value: values, // Array = OR logic
    });

    setFilterState((prev) => ({
      ...prev,
      filters: addOrReplaceFilter(prev.filters, newFilter),
    }));
  }
};

// Update AddFilterDropdown usage:
<AddFilterDropdown
  onAdd={handleAddFilter}
  activeFilters={filterState.filters}
/>

// REPLACE with FilterTypeMenu (if migrating from AddFilterDropdown):
<FilterTypeMenu
  onApply={handleFilterTypeMenuApply}
  activeFilters={{
    method: filterState.filters
      .filter((f) => f.field === "method")
      .flatMap((f) => (Array.isArray(f.value) ? f.value : [f.value])),
    client: filterState.filters
      .filter((f) => f.field === "client")
      .flatMap((f) => (Array.isArray(f.value) ? f.value : [f.value])),
    server: filterState.filters
      .filter((f) => f.field === "server")
      .flatMap((f) => (Array.isArray(f.value) ? f.value : [f.value])),
    session: filterState.filters
      .filter((f) => f.field === "session")
      .flatMap((f) => (Array.isArray(f.value) ? f.value : [f.value])),
  }}
/>
```

### Step 3: Verify Filter Utils Support Array Values

Ensure `addOrReplaceFilter` handles array values correctly:

```typescript
// In filter-utils.ts
export function addOrReplaceFilter(
  filters: Filter[],
  newFilter: Filter,
): Filter[] {
  // Remove any existing filter for the same field
  const withoutField = filters.filter((f) => f.field !== newFilter.field);

  // Add the new filter
  return [...withoutField, newFilter];
}

// Ensure createFilter supports array values:
export function createFilter(options: {
  field: FilterField;
  operator: FilterOperator;
  value: string | string[]; // Support both single and array values
}): Filter {
  return {
    id: crypto.randomUUID(),
    field: options.field,
    operator: options.operator,
    value: options.value,
  };
}
```

### Step 4: Update Filter Badge Display

Ensure filter badges display correctly for multi-value filters:

```typescript
// In FilterBadge component
export function FilterBadge({ filter, onRemove }: FilterBadgeProps) {
  const displayValue = Array.isArray(filter.value)
    ? filter.value.length === 1
      ? filter.value[0]
      : `${filter.value[0]} +${filter.value.length - 1} more`
    : filter.value;

  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-primary/10 text-sm">
      <span className="font-medium">{filter.field}:</span>
      <span>{displayValue}</span>
      <button
        onClick={() => onRemove(filter.id)}
        className="hover:bg-primary/20 rounded p-0.5"
        aria-label={`Remove ${filter.field} filter`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
```

## Key Differences from Previous Implementation

### Before (Apply/Cancel Pattern)
```typescript
// User clicks checkbox → temp state updates
// User clicks Apply → onApply called → filters update
// User clicks Cancel → temp state resets → menu closes
```

### After (Apply on Close Pattern)
```typescript
// User clicks checkbox → temp state updates
// User closes menu → onApply called → filters update
// User presses ESC → temp state resets → menu closes
```

## Benefits Summary

1. **Performance**: Single batch update vs multiple updates
2. **UX**: Exploration-friendly, less jarring
3. **Accessibility**: ESC key to cancel, clear mental model
4. **Design**: Matches Figma exactly
5. **Industry Standard**: Matches Gmail, Linear, GitHub patterns

## Migration Checklist

- [ ] Update FilterTypeMenu component
- [ ] Remove Apply/Cancel buttons
- [ ] Add handleOpenChange logic
- [ ] Add ESC key handler
- [ ] Add uncommitted changes indicator
- [ ] Update FilterBar integration
- [ ] Verify filter utils support arrays
- [ ] Update FilterBadge display
- [ ] Test multi-select behavior
- [ ] Test ESC key cancellation
- [ ] Test apply on close
- [ ] Verify no performance regressions

## Testing Scenarios

### Scenario 1: Basic Multi-Select
1. Open menu
2. Select "tools/call"
3. Select "prompts/get"
4. Close menu
5. **Expected**: Both filters applied, table shows only those methods

### Scenario 2: Cancel with ESC
1. Open menu
2. Select "tools/call"
3. Press ESC
4. **Expected**: No filter applied, menu closes

### Scenario 3: Remove All
1. Open menu (with active filters)
2. Uncheck all methods
3. Close menu
4. **Expected**: Method filter removed from bar

### Scenario 4: No Changes
1. Open menu (with active filters)
2. Make no changes
3. Close menu
4. **Expected**: No API calls, no updates

### Scenario 5: Multiple Filter Types
1. Open menu
2. Select 2 methods
3. Select 1 client
4. Close menu
5. **Expected**: Both filters applied in single update

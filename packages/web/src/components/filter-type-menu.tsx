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
    <DropdownMenu.Root
      open={open}
      onOpenChange={handleOpenChange}
      modal={false}
    >
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <Plus className="size-4" aria-hidden="true" />
          Add filter
          {hasUncommittedChanges && (
            <>
              <span
                className="absolute -top-1 -right-1 size-2 rounded-full bg-orange-500"
                aria-hidden="true"
              />
              <span className="sr-only">Uncommitted changes</span>
            </>
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

          {/* Helper text */}
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-t border-border mt-1">
            Filters apply when menu closes. Press ESC to cancel.
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

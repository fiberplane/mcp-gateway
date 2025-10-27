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
 * - Keyboard accessible
 * - Screen reader friendly
 */

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus } from "lucide-react";
import { useState } from "react";
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
   * Callback when filters are applied
   * @param filterType - The type of filter (method, client, server, session)
   * @param values - Array of selected values
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

  const handleApply = () => {
    // Apply all filter types with their selected values
    if (selectedMethods.length > 0) {
      onApply("method", selectedMethods);
    }
    if (selectedClients.length > 0) {
      onApply("client", selectedClients);
    }
    if (selectedServers.length > 0) {
      onApply("server", selectedServers);
    }
    if (selectedSessions.length > 0) {
      onApply("session", selectedSessions);
    }

    // Close menu after applying
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset selections to active filters
    setSelectedMethods(activeFilters.method ?? []);
    setSelectedClients(activeFilters.client ?? []);
    setSelectedServers(activeFilters.server ?? []);
    setSelectedSessions(activeFilters.session ?? []);

    setOpen(false);
  };

  const hasChanges =
    JSON.stringify(selectedMethods) !== JSON.stringify(activeFilters.method) ||
    JSON.stringify(selectedClients) !== JSON.stringify(activeFilters.client) ||
    JSON.stringify(selectedServers) !== JSON.stringify(activeFilters.server) ||
    JSON.stringify(selectedSessions) !== JSON.stringify(activeFilters.session);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="size-4" aria-hidden="true" />
          Add filter
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-lg"
          sideOffset={5}
          align="start"
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

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          {/* Action Buttons */}
          <div className="flex gap-2 p-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleApply}
              disabled={!hasChanges}
            >
              Apply
            </Button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

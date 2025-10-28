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
 * - Immediate apply (filters update as you select)
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
   * Callback when filters change
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

  // Fetch available values (only when dropdown is open)
  const methodsQuery = useAvailableMethods(undefined, open);
  const clientsQuery = useAvailableClients(open);
  const serversQuery = useAvailableServers(open);
  const sessionsQuery = useAvailableSessions(undefined, open);

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
            selectedValues={activeFilters.method ?? []}
            onSelectionChange={(values) => onApply("method", values)}
            isLoading={methodsQuery.isLoading}
            showColorBadges={true}
            searchPlaceholder="Search methods..."
          />

          {/* Session Filter */}
          <FilterValueSubmenu
            label="Session"
            values={sessionValues}
            selectedValues={activeFilters.session ?? []}
            onSelectionChange={(values) => onApply("session", values)}
            isLoading={sessionsQuery.isLoading}
            searchPlaceholder="Search sessions..."
          />

          {/* Client Filter */}
          <FilterValueSubmenu
            label="Client"
            values={clientValues}
            selectedValues={activeFilters.client ?? []}
            onSelectionChange={(values) => onApply("client", values)}
            isLoading={clientsQuery.isLoading}
            searchPlaceholder="Search clients..."
          />

          {/* Server Filter */}
          <FilterValueSubmenu
            label="Server"
            values={serverValues}
            selectedValues={activeFilters.server ?? []}
            onSelectionChange={(values) => onApply("server", values)}
            isLoading={serversQuery.isLoading}
            searchPlaceholder="Search servers..."
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

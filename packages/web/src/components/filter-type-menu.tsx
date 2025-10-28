/**
 * FilterTypeMenu Component
 *
 * Main cascading menu for adding filters.
 * Provides submenus for Method, Session, Client, and Server filters.
 *
 * Features:
 * - Data-driven submenus using TanStack Query
 * - Multi-select support with immediate apply
 * - Search within submenus
 */

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useAvailableClients,
  useAvailableMethods,
  useAvailableServers,
  useAvailableSessions,
} from "../lib/use-available-filters";
import { FilterValueSubmenu } from "./filter-value-submenu";
import { Button } from "./ui/button";
import * as DropdownMenu from "./ui/dropdown-menu";

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
  const methodsQuery = useAvailableMethods({ enabled: open });
  const clientsQuery = useAvailableClients({ enabled: open });
  const serversQuery = useAvailableServers({ enabled: open });
  const sessionsQuery = useAvailableSessions({ enabled: open });

  // Transform data for FilterValueSubmenu
  const methodValues =
    methodsQuery.data?.methods.map((m) => ({
      value: m.method,
      count: m.logCount,
    })) ?? [];

  const clientValues = useMemo(() => {
    const clients = clientsQuery.data?.clients ?? [];
    const aggregated = new Map<
      string,
      { count: number; versions: Set<string> }
    >();

    for (const client of clients) {
      const existing = aggregated.get(client.clientName);
      const version = client.clientVersion?.trim();
      if (existing) {
        existing.count += client.logCount;
        if (version) {
          existing.versions.add(version);
        }
      } else {
        const versions = new Set<string>();
        if (version) {
          versions.add(version);
        }
        aggregated.set(client.clientName, {
          count: client.logCount,
          versions,
        });
      }
    }

    return Array.from(aggregated.entries())
      .map(([name, { count, versions }]) => {
        let label = name;
        if (versions.size === 1) {
          label = `${name} (${Array.from(versions)[0]})`;
        } else if (versions.size > 1) {
          label = `${name} (${versions.size} versions)`;
        }
        return {
          value: name,
          label,
          count,
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [clientsQuery.data?.clients]);

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
        <DropdownMenu.Content align="start">
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

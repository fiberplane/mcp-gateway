/**
 * Cascading dropdown menu with filter type submenus.
 * Calls onApply when menu closes with selected values for each filter type.
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
import { CategoryIcon } from "./ui/field-icons";

interface FilterTypeMenuProps {
  /**
   * Callback when filters change
   * @param filterType - The type of filter (method, client, server, session)
   * @param values - Array of selected values (empty array = remove filter)
   * @param operator - The filter operator (is or contains)
   */
  onApply: (
    filterType: string,
    values: string[],
    operator: "is" | "contains",
  ) => void;

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

  /**
   * Currently active filter operators by type
   * Used to preserve operator when editing existing filters
   */
  activeOperators?: {
    method?: "is" | "contains";
    client?: "is" | "contains";
    server?: "is" | "contains";
    session?: "is" | "contains";
  };
}

export function FilterTypeMenu({
  onApply,
  activeFilters = {},
  activeOperators = {},
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
    })) ?? [];

  const clientValues = useMemo(() => {
    const clients = clientsQuery.data?.clients ?? [];
    const aggregated = new Map<string, Set<string>>();

    for (const client of clients) {
      const existing = aggregated.get(client.clientName);
      const version = client.clientVersion?.trim();
      if (existing) {
        if (version) {
          existing.add(version);
        }
      } else {
        const versions = new Set<string>();
        if (version) {
          versions.add(version);
        }
        aggregated.set(client.clientName, versions);
      }
    }

    return Array.from(aggregated.entries())
      .map(([name, versions]) => {
        let label = name;
        if (versions.size === 1) {
          label = `${name} (${Array.from(versions)[0]})`;
        } else if (versions.size > 1) {
          label = `${name} (${versions.size} versions)`;
        }
        return {
          value: name,
          label,
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [clientsQuery.data?.clients]);

  const serverValues =
    serversQuery.data?.servers.map((s) => ({
      value: s.name,
    })) ?? [];

  const sessionValues = useMemo(() => {
    const sessions = sessionsQuery.data?.sessions ?? [];
    // Dedupe sessions by sessionId (same session can appear on multiple servers)
    const uniqueSessions = new Map<string, string>();
    for (const session of sessions) {
      if (!uniqueSessions.has(session.sessionId)) {
        uniqueSessions.set(session.sessionId, session.sessionId);
      }
    }
    return Array.from(uniqueSessions.values()).map((sessionId) => ({
      value: sessionId,
    }));
  }, [sessionsQuery.data?.sessions]);

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
          {/* Filter by label */}
          <DropdownMenu.Label>Filter by</DropdownMenu.Label>
          <DropdownMenu.Separator />

          {/* Method Filter */}
          <FilterValueSubmenu
            label="Method"
            icon={
              <CategoryIcon
                category="method"
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            }
            values={methodValues}
            selectedValues={activeFilters.method ?? []}
            initialOperator={activeOperators.method}
            onSelectionChange={(values, operator) =>
              onApply("method", values, operator)
            }
            isLoading={methodsQuery.isLoading}
            showColorPills={true}
            searchPlaceholder="Search methods..."
          />

          {/* Session Filter */}
          <FilterValueSubmenu
            label="Session"
            icon={
              <CategoryIcon
                category="session"
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            }
            values={sessionValues}
            selectedValues={activeFilters.session ?? []}
            initialOperator={activeOperators.session}
            onSelectionChange={(values, operator) =>
              onApply("session", values, operator)
            }
            isLoading={sessionsQuery.isLoading}
            searchPlaceholder="Search sessions..."
          />

          {/* Client Filter */}
          <FilterValueSubmenu
            label="Client"
            icon={
              <CategoryIcon
                category="client"
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            }
            values={clientValues}
            selectedValues={activeFilters.client ?? []}
            initialOperator={activeOperators.client}
            onSelectionChange={(values, operator) =>
              onApply("client", values, operator)
            }
            isLoading={clientsQuery.isLoading}
            searchPlaceholder="Search clients..."
          />

          {/* Server Filter */}
          <FilterValueSubmenu
            label="Server"
            icon={
              <CategoryIcon
                category="server"
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            }
            values={serverValues}
            selectedValues={activeFilters.server ?? []}
            initialOperator={activeOperators.server}
            onSelectionChange={(values, operator) =>
              onApply("server", values, operator)
            }
            isLoading={serversQuery.isLoading}
            searchPlaceholder="Search servers..."
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

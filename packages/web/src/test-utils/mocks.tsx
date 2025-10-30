/**
 * Shared mock components for testing
 *
 * Consolidates mock.module() definitions to avoid conflicts when running
 * multiple test files together (Bun's mocks are global and persist).
 */

import { mock } from "bun:test";
import { createFilter } from "@fiberplane/mcp-gateway-types";

/**
 * Mock for FilterBadge component
 * Used by: command-filter-input.test.tsx, filter-bar.test.tsx
 */
export const mockFilterBadge = () => {
  mock.module("@/components/filter-badge", () => ({
    FilterBadge: ({ filter, onRemove, onEdit }: any) => (
      <div data-testid="filter-preview" data-filter-badge={filter.field}>
        <span>
          {filter.field} {filter.operator} {String(filter.value)}
        </span>
        {onRemove && (
          <button type="button" onClick={() => onRemove(filter.id)}>
            Remove
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={() => onEdit(filter.id)}>
            Edit
          </button>
        )}
      </div>
    ),
  }));
};

/**
 * Mock for FilterAutocomplete component
 * Used by: command-filter-input.test.tsx
 */
export const mockFilterAutocomplete = () => {
  mock.module("@/components/filter-autocomplete", () => ({
    FilterAutocomplete: ({
      suggestions,
      open,
      onSelect,
      errorContent,
      previewContent,
    }: any) => {
      if (!open) return null;
      return (
        <div data-testid="autocomplete-dropdown">
          {errorContent}
          {previewContent}
          {suggestions.map((s: any, i: number) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(s)}
              data-testid={`suggestion-${i}`}
            >
              {s.text}
            </button>
          ))}
        </div>
      );
    },
  }));
};

/**
 * Mock for CommandFilterInput component
 * Used by: filter-bar.test.tsx
 */
export const mockCommandFilterInput = () => {
  mock.module("@/components/command-filter-input", () => ({
    CommandFilterInput: ({
      onAddFilter,
      searchValue,
      onUpdateSearch,
      onCancel,
      initialValue,
    }: any) => (
      <div data-testid="command-filter-input">
        <input
          data-testid="search-input"
          value={initialValue || searchValue}
          onChange={(e) => onUpdateSearch(e.target.value)}
        />
        <button
          type="button"
          data-testid="add-filter-btn"
          onClick={() => {
            const filter = createFilter({
              field: "tokens",
              operator: "gt",
              value: 150,
            });
            onAddFilter(filter);
          }}
        >
          Add Filter
        </button>
        {onCancel && (
          <button type="button" data-testid="cancel-edit-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    ),
  }));
};

/**
 * Mock for AddFilterDropdown component
 * Used by: filter-bar.test.tsx
 */
export const mockAddFilterDropdown = () => {
  mock.module("@/components/add-filter-dropdown", () => ({
    AddFilterDropdown: () => (
      <button type="button" data-testid="add-filter-dropdown">
        Add Filter
      </button>
    ),
  }));
};

/**
 * Mock for use-available-filters hooks
 * Used by: command-filter-input.test.tsx
 */
export const mockUseAvailableFilters = () => {
  mock.module("@/lib/use-available-filters", () => ({
    useAvailableServers: () => ({
      data: { servers: [{ name: "test-server" }] },
    }),
    useAvailableClients: () => ({
      data: { clients: [{ clientName: "claude-code" }] },
    }),
    useAvailableMethods: () => ({
      data: { methods: [{ method: "tools/call" }] },
    }),
    useAvailableSessions: () => ({
      data: { sessions: [{ sessionId: "session-123" }] },
    }),
  }));
};

/**
 * Mock for nuqs hooks
 * Used by: filter-bar.test.tsx
 */
export const mockNuqs = (
  mockSearchQueries: string[],
  mockSetSearchQueries: any,
  mockFilterParams: Record<string, any>,
  mockSetFilterParams: any,
) => {
  mock.module("nuqs", () => ({
    useQueryState: (key: string) => {
      if (key === "search") {
        return [mockSearchQueries, mockSetSearchQueries];
      }
      return [[], mock(() => {})];
    },
    useQueryStates: () => {
      return [mockFilterParams, mockSetFilterParams];
    },
  }));
};

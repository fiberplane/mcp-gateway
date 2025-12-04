/**
 * Shared mock components for testing
 *
 * Consolidates mock.module() definitions to avoid conflicts when running
 * multiple test files together (Bun's mocks are global and persist).
 */

import { mock } from "bun:test";
import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { createFilter } from "@fiberplane/mcp-gateway-types";
import type { ReactNode } from "react";
import type { IApiClient } from "../lib/api";

type FilterBadgeProps = {
  filter: ReturnType<typeof createFilter>;
  onRemove?: (id: string) => void;
  onEdit?: (id: string) => void;
};

type FilterAutocompleteProps = {
  suggestions: Array<{ text: string; id?: string; icon?: ReactNode }>;
  open: boolean;
  onSelect: (suggestion: {
    text: string;
    id?: string;
    icon?: ReactNode;
  }) => void;
  errorContent?: ReactNode;
  previewContent?: ReactNode;
};

type CommandFilterInputProps = {
  onAddFilter: (filter: ReturnType<typeof createFilter>) => void;
  searchValue: string;
  onUpdateSearch: (value: string) => void;
  onCancel?: () => void;
  initialValue?: string;
};

/**
 * Mock for FilterBadge component
 * Used by: command-filter-input.test.tsx, filter-bar.test.tsx
 */
export const mockFilterBadge = () => {
  mock.module("@/components/filter-badge", () => ({
    FilterBadge: ({ filter, onRemove, onEdit }: FilterBadgeProps) => (
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
 *
 * NOTE: This mock must match the real component's behavior exactly:
 * - Returns null when closed OR when no suggestions AND no error/preview content
 * - Includes proper ARIA roles so tests pass consistently regardless of execution order
 * - Renders icons when provided
 */
export const mockFilterAutocomplete = () => {
  mock.module("@/components/filter-autocomplete", () => ({
    FilterAutocomplete: ({
      suggestions,
      open,
      onSelect,
      errorContent,
      previewContent,
    }: FilterAutocompleteProps) => {
      // Match real component: return null if not open or if no content to show
      if (
        !open ||
        (suggestions.length === 0 && !errorContent && !previewContent)
      ) {
        return null;
      }
      return (
        <section
          data-testid="autocomplete-dropdown"
          aria-label="Filter assistance"
        >
          {/* biome-ignore lint/a11y/useSemanticElements: Live region for screen readers, div is appropriate */}
          <div role="status" aria-live="polite" className="sr-only">
            {suggestions.length > 0
              ? `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"} available`
              : errorContent
                ? "Error in filter input"
                : "No suggestions"}
          </div>
          {errorContent}
          {previewContent}
          {suggestions.length > 0 && (
            <>
              <div role="listbox" aria-label="Filter suggestions">
                {suggestions.map((s, i) => (
                  <button
                    key={s.id || `suggestion-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === 0}
                    id={`filter-suggestion-${i}`}
                    onClick={() => onSelect(s)}
                    onMouseEnter={() => {}}
                    data-testid={`suggestion-${i}`}
                  >
                    {s.icon && (
                      <span className="size-4 shrink-0">{s.icon}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight truncate">
                        {s.text}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {/* Keyboard hints */}
              <div className="sticky bottom-0 px-3 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
                <kbd>Tab</kbd> to select • <kbd>Enter</kbd> to search •{" "}
                <kbd>Esc</kbd> to close
              </div>
            </>
          )}
        </section>
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
    }: CommandFilterInputProps) => (
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
          <button
            type="button"
            data-testid="cancel-edit-btn"
            onClick={onCancel}
          >
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
  mockSetSearchQueries: (value: string[]) => void,
  mockFilterParams: Record<string, unknown>,
  mockSetFilterParams: (updates: Record<string, unknown>) => void,
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

/**
 * Create a mock API client for tests
 * Returns an object that implements IApiClient interface
 */
export const createMockApiClient = (): IApiClient => ({
  getLogs: mock(async () => ({
    data: [],
    pagination: {
      count: 0,
      limit: 100,
      hasMore: false,
      oldestTimestamp: null,
      newestTimestamp: null,
    },
  })),
  getServers: mock(async () => ({ servers: [] })),
  getServerConfigs: mock(async () => ({ servers: [] })),
  addServer: mock(async () => ({
    success: true,
    server: {} as McpServerConfig,
  })),
  updateServer: mock(async () => ({ success: true, message: "Updated" })),
  deleteServer: mock(async () => ({ success: true, message: "Deleted" })),
  checkServerHealth: mock(async () => ({
    server: {
      name: "test",
      url: "http://localhost",
      type: "http" as const,
      headers: {},
      health: "up" as const,
      lastActivity: null,
      exchangeCount: 0,
    },
  })),
  getClients: mock(async () => ({ clients: [] })),
  getMethods: mock(async () => ({ methods: [] })),
  getSessions: mock(async () => ({ sessions: [] })),
  clearSessions: mock(async () => ({ success: true })),
  restartStdioServer: mock(async () => ({
    success: true,
    message: "Restarted",
  })),
});

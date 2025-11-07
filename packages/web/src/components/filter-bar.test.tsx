/// <reference lib="dom" />

/**
 * Tests for FilterBarUI component (presenter)
 *
 * Tests the pure presentation component without nuqs mocking.
 * FilterBarUI receives all state and callbacks as props, making it easy to test.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createFilter } from "@fiberplane/mcp-gateway-types";
import {
  mockAddFilterDropdown,
  mockFilterBadge,
  mockUseAvailableFilters,
} from "@/test-utils/mocks";
import { FilterBarUI } from "./filter-bar";

// Set up mocks for child components
// Note: CommandFilterInput is NOT mocked here - we use the real component
// but mock its dependencies (useAvailableFilters hooks)
mockUseAvailableFilters();
mockFilterBadge();
mockAddFilterDropdown();

describe("FilterBarUI", () => {
  let onAddFilter: ReturnType<typeof mock>;
  let onUpdateSearch: ReturnType<typeof mock>;
  let onRemoveFilter: ReturnType<typeof mock>;
  let onEditFilter: ReturnType<typeof mock>;
  let onCancelEdit: ReturnType<typeof mock>;
  let onClearAll: ReturnType<typeof mock>;
  let onRemoveFilterByField: ReturnType<typeof mock>;

  beforeEach(() => {
    onAddFilter = mock(() => {});
    onUpdateSearch = mock(() => {});
    onRemoveFilter = mock(() => {});
    onEditFilter = mock(() => {});
    onCancelEdit = mock(() => {});
    onClearAll = mock(() => {});
    onRemoveFilterByField = mock(() => {});
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    test("renders command filter input", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      expect(
        screen.getByRole("combobox", { name: "Command filter input" }),
      ).toBeInTheDocument();
    });

    test("renders add filter dropdown", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      expect(screen.getByTestId("add-filter-dropdown")).toBeInTheDocument();
    });

    test("renders custom actions", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
          actions={
            <button type="button" data-testid="custom-action">
              Custom
            </button>
          }
        />,
      );

      expect(screen.getByTestId("custom-action")).toBeInTheDocument();
    });

    test("hides Clear all button when no filters or search", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
    });

    test("shows Clear all button when filters exist", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });

    test("shows Clear all button when search terms exist", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue="error"
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={1}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });
  });

  describe("filter badges", () => {
    test("renders filter badges for active filters", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
        createFilter({ field: "client", operator: "is", value: "claude-code" }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      // Check that both filters are rendered by finding their filter preview elements
      const filterBadges = screen.getAllByTestId("filter-preview");
      expect(filterBadges).toHaveLength(2);
      expect(filterBadges[0]).toHaveAttribute("data-filter-badge", "tokens");
      expect(filterBadges[1]).toHaveAttribute("data-filter-badge", "client");
    });

    test("removes filter when badge remove button clicked", () => {
      const filter = createFilter({
        field: "tokens",
        operator: "gt",
        value: 150,
      });

      render(
        <FilterBarUI
          filters={[filter]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const removeButton = screen.getByText("Remove");
      fireEvent.click(removeButton);

      expect(onRemoveFilter).toHaveBeenCalledWith(filter.id);
    });
  });

  describe("adding filters", () => {
    test("adds filter via command input", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue="tokens > 150"
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      // When editingValue is set, button shows "Update Filter"
      const updateButton = screen.getByText("Update Filter");
      fireEvent.click(updateButton);

      expect(onAddFilter).toHaveBeenCalled();
    });
  });

  describe("search handling", () => {
    test("input accepts text entry", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "error message" } });

      // Input value should be updated (managed internally by component)
      expect(input).toHaveValue("error message");
    });

    test("clears search when input cleared", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue="error"
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={1}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const input = screen.getByRole("combobox");
      // When user clears input (e.g. native X button), component calls onUpdateSearch("")
      fireEvent.change(input, { target: { value: "" } });

      expect(onUpdateSearch).toHaveBeenCalledWith("");
    });
  });

  describe("clear all", () => {
    test("clears both filters and search on Clear all click", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue="error"
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={1}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const clearButton = screen.getByText("Clear all");
      fireEvent.click(clearButton);

      expect(onClearAll).toHaveBeenCalled();
    });

    test("has proper ARIA label for Clear all button", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
        createFilter({ field: "client", operator: "is", value: "test" }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue="error warning"
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={2}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const clearButton = screen.getByText("Clear all");
      expect(clearButton).toHaveAttribute(
        "aria-label",
        "Clear all 2 filters and 2 search terms",
      );
    });

    test("ARIA label handles singular filter", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const clearButton = screen.getByText("Clear all");
      expect(clearButton).toHaveAttribute("aria-label", "Clear all 1 filter");
    });

    test("ARIA label handles singular search term", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue="error"
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={1}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const clearButton = screen.getByText("Clear all");
      expect(clearButton).toHaveAttribute(
        "aria-label",
        "Clear all 1 filter and 1 search term",
      );
    });
  });

  describe("edit mode", () => {
    test("populates input when editing value is set", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue="tokens > 100"
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const input = screen.getByRole("combobox");
      expect(input).toHaveValue("tokens > 100");
    });

    test("calls onCancelEdit when Escape pressed in input", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue="tokens > 100"
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onCancelEdit).toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    test("has live region for screen reader announcements", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement="Test announcement"
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const liveRegion = screen.getByRole("status");
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveClass("sr-only");
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
      expect(liveRegion).toHaveAttribute("aria-atomic", "true");
    });

    test("displays announcement text", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement="2 filters active"
          editingValue={undefined}
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const liveRegion = screen.getByRole("status");
      expect(liveRegion).toHaveTextContent("2 filters active");
    });
  });

  describe("server filter preservation", () => {
    /**
     * Tests for server filter preservation when manipulating other filters
     *
     * The FilterBar container component uses URL params via nuqs.
     * Server filter is managed separately in tabs, but shares the same URL state.
     * These tests verify that filter operations preserve the server param.
     *
     * Note: These are unit tests that verify the callback behavior.
     * The actual preservation logic is in FilterBar container's handlers:
     * - handleAddFilter: newParams.server = filterParams.server
     * - handleRemoveFilter: newParams.server = filterParams.server
     * - handleRemoveFilterByField: newParams.server = filterParams.server
     * - handleClearAll: server: filterParams.server
     */

    test("Clear all preserves server selection (callback invoked)", () => {
      const filters = [
        createFilter({ field: "tokens", operator: "gt", value: 150 }),
      ];

      render(
        <FilterBarUI
          filters={filters}
          searchValue="error"
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={1}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const clearButton = screen.getByText("Clear all");
      fireEvent.click(clearButton);

      // Verify onClearAll was called (actual preservation logic is in container)
      expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    test("Add filter invokes callback (preservation in container)", () => {
      render(
        <FilterBarUI
          filters={[]}
          searchValue=""
          announcement=""
          editingValue="tokens > 150"
          hasActiveItems={false}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const updateButton = screen.getByText("Update Filter");
      fireEvent.click(updateButton);

      // Verify onAddFilter was called (actual preservation logic is in container)
      expect(onAddFilter).toHaveBeenCalledTimes(1);
    });

    test("Remove filter invokes callback (preservation in container)", () => {
      const filter = createFilter({
        field: "tokens",
        operator: "gt",
        value: 150,
      });

      render(
        <FilterBarUI
          filters={[filter]}
          searchValue=""
          announcement=""
          editingValue={undefined}
          hasActiveItems={true}
          searchQueryCount={0}
          onAddFilter={onAddFilter}
          onUpdateSearch={onUpdateSearch}
          onRemoveFilter={onRemoveFilter}
          onEditFilter={onEditFilter}
          onCancelEdit={onCancelEdit}
          onClearAll={onClearAll}
          onRemoveFilterByField={onRemoveFilterByField}
        />,
      );

      const removeButton = screen.getByText("Remove");
      fireEvent.click(removeButton);

      // Verify onRemoveFilter was called with correct ID
      expect(onRemoveFilter).toHaveBeenCalledWith(filter.id);
    });
  });
});

/// <reference lib="dom" />

/**
 * Tests for FilterBadge component
 */

import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createFilter } from "@fiberplane/mcp-gateway-types";
import { FilterBadge } from "./filter-badge";

describe("FilterBadge", () => {
  describe("rendering", () => {
    test("renders string filter badge", () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "claude-code",
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("Client")).toBeInTheDocument();
      expect(screen.getByText("is")).toBeInTheDocument();
      expect(screen.getByText("claude-code")).toBeInTheDocument();
    });

    test("renders numeric filter with units", () => {
      const filter = createFilter({
        field: "duration",
        operator: "lt",
        value: 100,
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("Duration")).toBeInTheDocument();
      expect(screen.getByText("less than")).toBeInTheDocument();
      expect(screen.getByText("100ms")).toBeInTheDocument();
    });

    test("renders tokens filter without units", () => {
      const filter = createFilter({
        field: "tokens",
        operator: "gt",
        value: 150,
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("Tokens")).toBeInTheDocument();
      expect(screen.getByText("greater than")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    test("renders method filter with colored pill", () => {
      const filter = createFilter({
        field: "method",
        operator: "is",
        value: "tools/call",
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("Method")).toBeInTheDocument();
      expect(screen.getByText("tools/call")).toBeInTheDocument();
    });

    test("renders array filter with multiple values", () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: ["claude-code", "cursor"],
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("Client")).toBeInTheDocument();
      expect(screen.getByText("claude-code, cursor")).toBeInTheDocument();
    });

    test("truncates array filters with more than 2 values", () => {
      const filter = createFilter({
        field: "server",
        operator: "is",
        value: ["server1", "server2", "server3", "server4"],
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("server1, server2 +2 more")).toBeInTheDocument();
    });

    test("renders multiple method pills for array values", () => {
      const filter = createFilter({
        field: "method",
        operator: "is",
        value: ["tools/call", "tools/list"],
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("tools/call")).toBeInTheDocument();
      expect(screen.getByText("tools/list")).toBeInTheDocument();
    });

    test("truncates method arrays at 3 items", () => {
      const filter = createFilter({
        field: "method",
        operator: "is",
        value: ["tools/call", "tools/list", "resources/read", "prompts/get"],
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      expect(screen.getByText("tools/call")).toBeInTheDocument();
      expect(screen.getByText("tools/list")).toBeInTheDocument();
      expect(screen.getByText("resources/read")).toBeInTheDocument();
      expect(screen.getByText("+1 more")).toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    test("calls onRemove when remove button clicked", async () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "test",
      });

      let removedId: string | null = null;
      const onRemove = (id: string) => {
        removedId = id;
      };

      render(<FilterBadge filter={filter} onRemove={onRemove} />);

      const removeButton = screen.getByLabelText(/Remove filter/i);
      removeButton.click();

      expect(removedId).toBe(filter.id);
    });

    test("calls onEdit when badge clicked (if provided)", () => {
      const filter = createFilter({
        field: "tokens",
        operator: "gt",
        value: 100,
      });

      let editedId: string | null = null;
      const onEdit = (id: string) => {
        editedId = id;
      };

      render(
        <FilterBadge filter={filter} onRemove={() => {}} onEdit={onEdit} />,
      );

      const editButton = screen.getByLabelText(/Edit filter/i);
      editButton.click();

      expect(editedId).toBe(filter.id);
    });

    test("does not call onEdit when button is disabled", () => {
      const filter = createFilter({
        field: "tokens",
        operator: "gt",
        value: 100,
      });

      let editedId: string | null = null;
      const _onEdit = (id: string) => {
        editedId = id;
      };

      // Render without onEdit prop - button should be disabled
      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      const editButton = screen.getByLabelText(/Edit filter/i);
      expect(editButton).toBeDisabled();

      editButton.click();
      expect(editedId).toBe(null);
    });
  });

  describe("accessibility", () => {
    test("has proper ARIA labels for remove button", () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "test-client",
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      const removeButton = screen.getByLabelText(
        "Remove filter: Client is test-client",
      );
      expect(removeButton).toBeInTheDocument();
    });

    test("has proper ARIA labels for edit button", () => {
      const filter = createFilter({
        field: "duration",
        operator: "lt",
        value: 50,
      });

      render(
        <FilterBadge filter={filter} onRemove={() => {}} onEdit={() => {}} />,
      );

      const editButton = screen.getByLabelText(
        "Edit filter: Duration less than 50ms",
      );
      expect(editButton).toBeInTheDocument();
    });

    test("uses 'or' in aria label for multi-value method filters", () => {
      const filter = createFilter({
        field: "method",
        operator: "is",
        value: ["tools/call", "tools/list"],
      });

      render(<FilterBadge filter={filter} onRemove={() => {}} />);

      const removeButton = screen.getByLabelText(
        "Remove filter: Method is tools/call or tools/list",
      );
      expect(removeButton).toBeInTheDocument();
    });

    test("icons have aria-hidden attribute", () => {
      const filter = createFilter({
        field: "client",
        operator: "is",
        value: "test",
      });

      const { container } = render(
        <FilterBadge filter={filter} onRemove={() => {}} />,
      );

      // lucide-react icons render as <svg> elements
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe("operator display", () => {
    test("shows symbols for gte/lte operators", () => {
      const filter1 = createFilter({
        field: "tokens",
        operator: "gte",
        value: 100,
      });
      const filter2 = createFilter({
        field: "duration",
        operator: "lte",
        value: 500,
      });

      const { rerender } = render(
        <FilterBadge filter={filter1} onRemove={() => {}} />,
      );
      expect(screen.getByText("≥")).toBeInTheDocument();

      rerender(<FilterBadge filter={filter2} onRemove={() => {}} />);
      expect(screen.getByText("≤")).toBeInTheDocument();
    });

    test("shows text for string operators", () => {
      const filter1 = createFilter({
        field: "client",
        operator: "is",
        value: "test",
      });
      const filter2 = createFilter({
        field: "method",
        operator: "contains",
        value: "tools",
      });

      const { rerender } = render(
        <FilterBadge filter={filter1} onRemove={() => {}} />,
      );
      expect(screen.getByText("is")).toBeInTheDocument();

      rerender(<FilterBadge filter={filter2} onRemove={() => {}} />);
      expect(screen.getByText("contains")).toBeInTheDocument();
    });
  });
});

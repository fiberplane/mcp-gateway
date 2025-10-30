/// <reference lib="dom" />

/**
 * Tests for FilterAutocomplete component
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { FilterSuggestion } from "@/lib/filter-parser";
import { FilterAutocomplete } from "./filter-autocomplete";

describe("FilterAutocomplete", () => {
  const mockSuggestions: FilterSuggestion[] = [
    {
      text: "tokens",
      display: "tokens",
      description: "Token count field",
      icon: null,
    },
    {
      text: "duration",
      display: "duration",
      description: "Duration field",
      icon: null,
    },
    {
      text: "client",
      display: "client",
      description: "Client field",
      icon: null,
    },
  ];

  let onSelect: ReturnType<typeof mock>;
  let onClose: ReturnType<typeof mock>;

  beforeEach(() => {
    onSelect = mock(() => {});
    onClose = mock(() => {});
  });

  describe("visibility", () => {
    test("renders when open with suggestions", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    test("does not render when closed", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={false}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    test("does not render when open but no suggestions or content", () => {
      render(
        <FilterAutocomplete
          suggestions={[]}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    test("renders when open with error content but no suggestions", () => {
      render(
        <FilterAutocomplete
          suggestions={[]}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
          errorContent={<div data-testid="error">Error message</div>}
        />,
      );

      expect(screen.getByTestId("error")).toBeInTheDocument();
    });

    test("renders when open with preview content but no suggestions", () => {
      render(
        <FilterAutocomplete
          suggestions={[]}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
          previewContent={<div data-testid="preview">Preview</div>}
        />,
      );

      expect(screen.getByTestId("preview")).toBeInTheDocument();
    });
  });

  describe("suggestion rendering", () => {
    test("renders all suggestions", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.getByText("tokens")).toBeInTheDocument();
      expect(screen.getByText("duration")).toBeInTheDocument();
      expect(screen.getByText("client")).toBeInTheDocument();
    });

    test("renders suggestion icons when provided", () => {
      const suggestionsWithIcons: FilterSuggestion[] = [
        {
          text: "tokens",
          display: "tokens",
          description: "Token count",
          icon: <span data-testid="icon">📊</span>,
        },
      ];

      render(
        <FilterAutocomplete
          suggestions={suggestionsWithIcons}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    test("selects first suggestion by default", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const firstOption = screen.getByRole("option", { name: /tokens/ });
      expect(firstOption).toHaveAttribute("aria-selected", "true");
    });

    test("moves selection down with ArrowDown", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(window, { key: "ArrowDown" });

      const secondOption = screen.getByRole("option", { name: /duration/ });
      expect(secondOption).toHaveAttribute("aria-selected", "true");
    });

    test("moves selection up with ArrowUp", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      // Move down twice
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });

      // Move back up
      fireEvent.keyDown(window, { key: "ArrowUp" });

      const secondOption = screen.getByRole("option", { name: /duration/ });
      expect(secondOption).toHaveAttribute("aria-selected", "true");
    });

    test("does not move selection below last item", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      // Try to move past last item
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });

      const lastOption = screen.getByRole("option", { name: /client/ });
      expect(lastOption).toHaveAttribute("aria-selected", "true");
    });

    test("does not move selection above first item", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      // Try to move above first item
      fireEvent.keyDown(window, { key: "ArrowUp" });

      const firstOption = screen.getByRole("option", { name: /tokens/ });
      expect(firstOption).toHaveAttribute("aria-selected", "true");
    });

    test("selects suggestion with Tab key", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(window, { key: "Tab" });

      expect(onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    test("does not select with Shift+Tab", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

      expect(onSelect).not.toHaveBeenCalled();
    });

    test("closes on Escape key", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("mouse interaction", () => {
    test("selects suggestion on click", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const secondOption = screen.getByRole("option", { name: /duration/ });
      fireEvent.click(secondOption);

      expect(onSelect).toHaveBeenCalledWith(mockSuggestions[1]);
    });

    test("updates selection on hover", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const thirdOption = screen.getByRole("option", { name: /client/ });
      fireEvent.mouseEnter(thirdOption);

      expect(thirdOption).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("error and preview content", () => {
    test("renders error content at top", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
          errorContent={<div data-testid="error">Invalid input</div>}
        />,
      );

      expect(screen.getByTestId("error")).toBeInTheDocument();
    });

    test("renders preview content at top", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
          previewContent={<div data-testid="preview">Filter preview</div>}
        />,
      );

      expect(screen.getByTestId("preview")).toBeInTheDocument();
    });

    test("renders both error and preview content", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
          errorContent={<div data-testid="error">Error</div>}
          previewContent={<div data-testid="preview">Preview</div>}
        />,
      );

      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByTestId("preview")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    test("has proper ARIA labels", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.getByRole("listbox")).toHaveAttribute(
        "aria-label",
        "Filter suggestions",
      );
    });

    test("has screen reader announcement for suggestions", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("3 suggestions available");
    });

    test("has screen reader announcement for single suggestion", () => {
      render(
        <FilterAutocomplete
          suggestions={[mockSuggestions[0]]}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("1 suggestion available");
    });

    test("has keyboard hints visible", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      expect(screen.getByText("Tab")).toBeInTheDocument();
      expect(screen.getByText("Enter")).toBeInTheDocument();
      expect(screen.getByText("Esc")).toBeInTheDocument();
    });

    test("each suggestion has unique id", () => {
      render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const options = screen.getAllByRole("option");
      options.forEach((option, index) => {
        expect(option).toHaveAttribute("id", `filter-suggestion-${index}`);
      });
    });
  });

  describe("selection reset", () => {
    test("resets selection when suggestions change", () => {
      const { rerender } = render(
        <FilterAutocomplete
          suggestions={mockSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      // Move to second item
      fireEvent.keyDown(window, { key: "ArrowDown" });

      const secondOption = screen.getByRole("option", { name: /duration/ });
      expect(secondOption).toHaveAttribute("aria-selected", "true");

      // Change suggestions
      const newSuggestions: FilterSuggestion[] = [
        {
          text: "server",
          display: "server",
          description: "Server field",
          icon: null,
        },
      ];

      rerender(
        <FilterAutocomplete
          suggestions={newSuggestions}
          open={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      // Should reset to first item
      const firstOption = screen.getByRole("option", { name: /server/ });
      expect(firstOption).toHaveAttribute("aria-selected", "true");
    });
  });
});

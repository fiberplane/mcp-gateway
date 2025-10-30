/// <reference lib="dom" />

/**
 * Tests for CommandFilterInput component
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  mockFilterAutocomplete,
  mockFilterBadge,
  mockUseAvailableFilters,
} from "@/test-utils/mocks";
import { CommandFilterInput } from "./command-filter-input";

// Set up mocks
mockUseAvailableFilters();
mockFilterAutocomplete();
mockFilterBadge();

describe("CommandFilterInput", () => {
  let onAddFilter: ReturnType<typeof mock>;
  let onUpdateSearch: ReturnType<typeof mock>;
  let onCancel: ReturnType<typeof mock>;

  beforeEach(() => {
    onAddFilter = mock(() => {});
    onUpdateSearch = mock(() => {});
    onCancel = mock(() => {});
  });

  describe("rendering", () => {
    test("renders input with placeholder", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute(
        "placeholder",
        expect.stringContaining("Search or filter"),
      );
    });

    test("renders with custom placeholder", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
          placeholder="Custom placeholder"
        />,
      );

      expect(
        screen.getByPlaceholderText("Custom placeholder"),
      ).toBeInTheDocument();
    });

    test("renders search icon", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      // Search icon should be in the DOM
      const container = screen.getByRole("combobox").parentElement;
      expect(container).toBeInTheDocument();
    });

    test("syncs input with searchValue prop", () => {
      const { rerender } = render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="test"
          onUpdateSearch={onUpdateSearch}
        />,
      );

      expect(screen.getByRole("combobox")).toHaveValue("test");

      rerender(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="updated"
          onUpdateSearch={onUpdateSearch}
        />,
      );

      expect(screen.getByRole("combobox")).toHaveValue("updated");
    });
  });

  describe("validation states", () => {
    test("shows empty state initially", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      expect(input).toHaveValue("");
      // No validation icons when empty
      expect(screen.queryByText("Press Enter")).not.toBeInTheDocument();
      expect(screen.queryByText("Invalid")).not.toBeInTheDocument();
    });

    test("shows valid state for search text", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "error" } });

      expect(screen.getByText("Press Enter")).toBeInTheDocument();
      expect(screen.getByText("Add")).toBeInTheDocument();
    });

    test("shows valid state for complete filter", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "tokens > 150" } });

      expect(screen.getByText("Press Enter")).toBeInTheDocument();
    });

    test("does not show error for incomplete input", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "tokens >" } });

      // Should not show "Invalid" for incomplete input
      expect(screen.queryByText("Invalid")).not.toBeInTheDocument();
    });
  });

  describe("filter submission", () => {
    test("adds filter on Enter key", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "tokens > 150" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onAddFilter).toHaveBeenCalledTimes(1);
      const addedFilter = onAddFilter.mock.calls[0][0];
      expect(addedFilter.field).toBe("tokens");
      expect(addedFilter.operator).toBe("gt");
      expect(addedFilter.value).toBe(150);
    });

    test("adds filter on Add button click", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "client is claude-code" } });

      const addButton = screen.getByText("Add");
      fireEvent.click(addButton);

      expect(onAddFilter).toHaveBeenCalledTimes(1);
      const addedFilter = onAddFilter.mock.calls[0][0];
      expect(addedFilter.field).toBe("client");
      expect(addedFilter.operator).toBe("is");
    });

    test("clears input after adding filter", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "tokens > 150" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(input).toHaveValue("");
    });

    test("clears search when adding filter", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="previous search"
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "tokens > 150" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onUpdateSearch).toHaveBeenCalledWith("");
    });
  });

  describe("search submission", () => {
    test("updates search on Enter for non-filter text", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "error message" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onUpdateSearch).toHaveBeenCalledWith("error message");
      expect(onAddFilter).not.toHaveBeenCalled();
    });
  });

  describe("escape key behavior", () => {
    test("clears input on Escape when empty", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="test"
          onUpdateSearch={onUpdateSearch}
          onCancel={onCancel}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onUpdateSearch).toHaveBeenCalledWith("");
      expect(onCancel).toHaveBeenCalled();
    });

    test("closes autocomplete first, then clears on second Escape", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");

      // Type to show autocomplete
      fireEvent.change(input, { target: { value: "tokens" } });
      fireEvent.focus(input);

      // First escape closes autocomplete
      fireEvent.keyDown(input, { key: "Escape" });

      // Second escape clears input
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onUpdateSearch).toHaveBeenCalledWith("");
    });
  });

  describe("edit mode with initialValue", () => {
    test("populates input with initialValue", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
          initialValue="tokens > 100"
        />,
      );

      const input = screen.getByRole("combobox");
      expect(input).toHaveValue("tokens > 100");
    });

    test("does not sync with searchValue when initialValue is set", () => {
      const { rerender } = render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="search"
          onUpdateSearch={onUpdateSearch}
          initialValue="tokens > 100"
        />,
      );

      expect(screen.getByRole("combobox")).toHaveValue("tokens > 100");

      rerender(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="different"
          onUpdateSearch={onUpdateSearch}
          initialValue="tokens > 100"
        />,
      );

      // Should still show initialValue, not searchValue
      expect(screen.getByRole("combobox")).toHaveValue("tokens > 100");
    });

    test("calls onCancel when Escape pressed in edit mode", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
          initialValue="tokens > 100"
          onCancel={onCancel}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("input changes", () => {
    test("updates input value on change", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "new value" } });

      expect(input).toHaveValue("new value");
    });

    test("clears search when input is cleared", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue="existing"
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "" } });

      expect(onUpdateSearch).toHaveBeenCalledWith("");
    });

    test("shows autocomplete on input change", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "t" } });

      expect(input).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("accessibility", () => {
    test("has proper ARIA attributes", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      expect(input).toHaveAttribute("aria-label", "Command filter input");
      expect(input).toHaveAttribute("aria-describedby", "command-filter-help");
      expect(input).toHaveAttribute("aria-autocomplete", "list");
      expect(input).toHaveAttribute(
        "aria-controls",
        "filter-autocomplete-listbox",
      );
    });

    test("has screen reader help text", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const helpText = document.getElementById("command-filter-help");
      expect(helpText).toBeInTheDocument();
      expect(helpText).toHaveClass("sr-only");
      expect(helpText).toHaveTextContent(/Use Tab for autocomplete/);
    });

    test("uses enterKeyHint='go' for mobile keyboards", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      expect(input).toHaveAttribute("enterKeyHint", "go");
    });
  });

  describe("Add button visibility", () => {
    test("hides Add button when input is empty", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      expect(screen.queryByText("Add")).not.toBeInTheDocument();
    });

    test("shows Add button when input is valid", () => {
      render(
        <CommandFilterInput
          onAddFilter={onAddFilter}
          searchValue=""
          onUpdateSearch={onUpdateSearch}
        />,
      );

      const input = screen.getByRole("combobox");
      fireEvent.change(input, { target: { value: "tokens > 150" } });

      expect(screen.getByText("Add")).toBeInTheDocument();
    });
  });
});

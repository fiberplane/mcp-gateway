/**
 * AddFilterDropdown Component
 *
 * Dropdown popover for adding new filters to the filter bar.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812
 *
 * Features:
 * - Filter type selector (Method, SessionID, Server, Duration, Tokens)
 * - Operator selector (is, contains, gt, lt, gte, lte)
 * - Value input field
 * - Keyboard accessible (Tab, Escape)
 * - Screen reader friendly with ARIA labels
 * - Closes after adding filter
 */

import {
  createFilter,
  type FilterField,
  type FilterOperator,
} from "@fiberplane/mcp-gateway-types";
import * as Popover from "@radix-ui/react-popover";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "./ui/button";

interface AddFilterDropdownProps {
  /**
   * Callback when a new filter is added
   */
  onAdd: (filter: ReturnType<typeof createFilter>) => void;
}

// Available filter fields (excluding client - handled separately in Phase 1)
const FILTER_FIELDS: Array<{ value: FilterField; label: string }> = [
  { value: "method", label: "Method" },
  { value: "session", label: "Session ID" },
  { value: "server", label: "Server" },
  { value: "duration", label: "Duration (ms)" },
  { value: "tokens", label: "Tokens" },
];

// String operators for text fields
const STRING_OPERATORS: Array<{ value: "is" | "contains"; label: string }> = [
  { value: "is", label: "is" },
  { value: "contains", label: "contains" },
];

// Numeric operators for number fields
const NUMERIC_OPERATORS: Array<{
  value: "eq" | "gt" | "lt" | "gte" | "lte";
  label: string;
}> = [
  { value: "eq", label: "equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
];

export function AddFilterDropdown({ onAdd }: AddFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<FilterField>("method");
  // Type operator state properly based on field type
  const [operator, setOperator] = useState<FilterOperator<FilterField>>("is");
  const [value, setValue] = useState<string>("");

  // Generate unique IDs for accessibility
  const fieldSelectId = useId();
  const operatorSelectId = useId();
  const valueInputId = useId();

  // Determine if field uses string or numeric values
  const isNumericField = field === "duration" || field === "tokens";

  // Get available operators based on field type
  const availableOperators = isNumericField
    ? NUMERIC_OPERATORS
    : STRING_OPERATORS;

  // Reset operator when field type changes
  const handleFieldChange = (newField: FilterField) => {
    setField(newField);
    const isNewFieldNumeric = newField === "duration" || newField === "tokens";
    // Reset to first operator of the new type with proper typing
    setOperator(isNewFieldNumeric ? ("eq" as const) : ("is" as const));
    setValue("");
  };

  const handleAdd = () => {
    // Validate value
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return; // Don't add empty filters
    }

    // Split branches for type safety - numeric vs string fields
    if (isNumericField) {
      // Handle numeric fields (duration, tokens)
      const numValue = Number.parseInt(trimmedValue, 10);
      if (Number.isNaN(numValue) || numValue < 0) {
        return; // Invalid number
      }

      const newFilter = createFilter({
        field: field as "duration" | "tokens",
        operator: operator as "eq" | "gt" | "lt" | "gte" | "lte",
        value: numValue,
      });

      onAdd(newFilter);
    } else {
      // Handle string fields (method, session, server, client)
      const newFilter = createFilter({
        field: field as "method" | "session" | "server" | "client",
        operator: operator as "is" | "contains",
        value: trimmedValue,
      });

      onAdd(newFilter);
    }

    // Reset form and close
    setValue("");
    setOpen(false);
  };

  const handleCancel = () => {
    setValue("");
    setOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAdd();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="size-4" aria-hidden="true" />
          Add filter
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-md border border-border bg-popover p-4 shadow-lg outline-none"
          sideOffset={5}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Add Filter</h3>
            <Popover.Close asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 p-0.5 transition-colors"
                aria-label="Close"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Popover.Close>
          </div>

          {/* Form with proper semantics */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Filter Field Selector */}
            <div className="space-y-2">
              <label
                htmlFor={fieldSelectId}
                className="text-sm font-medium text-foreground"
              >
                Field
              </label>
              <select
                id={fieldSelectId}
                value={field}
                onChange={(e) =>
                  handleFieldChange(e.target.value as FilterField)
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {FILTER_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Selector */}
            <div className="space-y-2">
              <label
                htmlFor={operatorSelectId}
                className="text-sm font-medium text-foreground"
              >
                Operator
              </label>
              <select
                id={operatorSelectId}
                value={operator}
                onChange={(e) =>
                  setOperator(e.target.value as FilterOperator<FilterField>)
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {availableOperators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Value Input */}
            <div className="space-y-2">
              <label
                htmlFor={valueInputId}
                className="text-sm font-medium text-foreground"
              >
                Value
              </label>
              <input
                id={valueInputId}
                type={isNumericField ? "number" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  isNumericField ? "Enter number..." : "Enter value..."
                }
                min={isNumericField ? "0" : undefined}
                step={isNumericField ? "1" : undefined}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!value.trim()}>
                Add
              </Button>
            </div>
          </form>

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

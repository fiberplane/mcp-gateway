/**
 * FilterBadge Component
 *
 * Displays an active filter as a badge with a remove button.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2813
 *
 * Features:
 * - Shows field name, operator, and value separately
 * - Method filter values have purple badge background
 * - Other filter values are plain text (monospace)
 * - Icons for different filter types
 * - Remove button (X)
 * - Keyboard accessible (Tab + Enter)
 * - Screen reader friendly with ARIA labels
 */

import type { Filter } from "@fiberplane/mcp-gateway-types";
import { BarChart3, Clock, List, Monitor, Server, X, Zap } from "lucide-react";
import { getMethodColor } from "../lib/method-colors";

interface FilterBadgeProps {
  filter: Filter;
  onRemove: (filterId: string) => void;
}

// Field display names
const FIELD_LABELS: Record<Filter["field"], string> = {
  client: "Client",
  method: "Method",
  session: "SessionID",
  server: "Server",
  duration: "Duration",
  tokens: "Tokens",
};

// Operator display labels
const OPERATOR_LABELS: Record<string, string> = {
  is: "is",
  contains: "contains",
  eq: "equals",
  gt: "greater than",
  lt: "less than",
  gte: "≥",
  lte: "≤",
};

// Icons for different filter types (matching table header icons)
function getFilterIcon(field: Filter["field"]) {
  switch (field) {
    case "method":
      return <Zap className="size-4" aria-hidden="true" />;
    case "session":
      return <List className="size-4" aria-hidden="true" />;
    case "client":
      return <Monitor className="size-4" aria-hidden="true" />; // Client entity
    case "server":
      return <Server className="size-4" aria-hidden="true" />; // Server entity
    case "duration":
      return <Clock className="size-4" aria-hidden="true" />;
    case "tokens":
      return <BarChart3 className="size-4" aria-hidden="true" />;
  }
}

// Format value with units if needed
// Handles both single values and arrays with truncation
function formatValue(filter: Filter): string {
  const formatSingleValue = (value: string | number): string => {
    if (typeof value === "number") {
      return filter.field === "duration" ? `${value}ms` : String(value);
    }
    return value;
  };

  // Handle array values
  if (Array.isArray(filter.value)) {
    const values = filter.value;

    // Truncate long arrays to first 2 items + count
    if (values.length > 2) {
      const displayValues = values
        .slice(0, 2)
        .map((v) => formatSingleValue(v as string | number));
      const remainingCount = values.length - 2;

      return `${displayValues.join(", ")} +${remainingCount} more`;
    }

    // Show all items for arrays with 2 or fewer items
    return values
      .map((v) => formatSingleValue(v as string | number))
      .join(", ");
  }

  // Handle single values
  return formatSingleValue(filter.value as string | number);
}

export function FilterBadge({ filter, onRemove }: FilterBadgeProps) {
  const fieldLabel = FIELD_LABELS[filter.field];
  const operatorLabel = OPERATOR_LABELS[filter.operator] || filter.operator;
  const value = formatValue(filter);
  const icon = getFilterIcon(filter.field);

  // Method filters get a purple badge for the value (matching Figma)
  const shouldHighlightValue = filter.field === "method";

  // For multi-value methods, use "or" for better accessibility
  const label =
    filter.field === "method" && Array.isArray(filter.value)
      ? `${fieldLabel} ${operatorLabel} ${filter.value.join(" or ")}`
      : `${fieldLabel} ${operatorLabel} ${value}`;

  return (
    <div className="inline-flex items-center gap-2 h-9 px-2 border border-border rounded-md bg-background">
      {/* Icon */}
      {icon}

      {/* Field name */}
      <span className="text-sm font-medium text-muted-foreground">
        {fieldLabel}
      </span>

      {/* Operator */}
      <span className="text-sm text-muted-foreground">{operatorLabel}</span>

      {/* Value - styled differently based on filter type */}
      {filter.field === "method" && Array.isArray(filter.value) ? (
        // Multiple method pills with individual colors
        <div className="inline-flex items-center gap-1 flex-wrap">
          {filter.value.slice(0, 3).map((methodValue) => (
            <div
              key={String(methodValue)}
              className="inline-flex items-center justify-center px-1.5 py-1 rounded-md"
              style={{ backgroundColor: getMethodColor(String(methodValue)) }}
            >
              <span className="text-sm font-mono text-foreground">
                {String(methodValue)}
              </span>
            </div>
          ))}
          {filter.value.length > 3 && (
            <span className="text-sm text-muted-foreground">
              +{filter.value.length - 3} more
            </span>
          )}
        </div>
      ) : shouldHighlightValue ? (
        // Single method pill with its specific color
        <div
          className="inline-flex items-center justify-center px-1.5 py-1 rounded-md"
          style={{
            backgroundColor: getMethodColor(String(filter.value)),
          }}
        >
          <span className="text-sm font-mono text-foreground">{value}</span>
        </div>
      ) : (
        // Non-method fields - plain text
        <span className="text-sm font-mono text-foreground">{value}</span>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(filter.id)}
        className="inline-flex items-center justify-center rounded-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 p-2 transition-colors"
        aria-label={`Remove filter: ${label}`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Displays an active filter as a removable badge.
 * Method filters show colored pills, arrays are truncated with "+N more".
 */

import type { Filter } from "@fiberplane/mcp-gateway-types";
import { BarChart3, Clock, List, Monitor, Server, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMethodColor } from "../lib/method-colors";
import { IconButton } from "./ui/button";
import { ColorPill } from "./ui/color-pill";

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
function FilterIcon({
  field,
  className: extraClasses,
}: {
  field: Filter["field"];
  className: string;
}) {
  const className = cn(extraClasses, "size-4");

  switch (field) {
    case "method":
      return <Zap className={className} aria-hidden="true" />;
    case "session":
      return <List className={className} aria-hidden="true" />;
    case "client":
      return <Monitor className={className} aria-hidden="true" />; // Client entity
    case "server":
      return <Server className={className} aria-hidden="true" />; // Server entity
    case "duration":
      return <Clock className={className} aria-hidden="true" />;
    case "tokens":
      return <BarChart3 className={className} aria-hidden="true" />;
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

  // Method filters get a purple badge for the value (matching Figma)
  const shouldHighlightValue = filter.field === "method";

  // For multi-value methods, use "or" for better accessibility
  const label =
    filter.field === "method" && Array.isArray(filter.value)
      ? `${fieldLabel} ${operatorLabel} ${filter.value.join(" or ")}`
      : `${fieldLabel} ${operatorLabel} ${value}`;

  return (
    <div className="inline-flex items-center gap-2 h-9 px-2 border border-foreground rounded-md bg-card">
      {/* Icon */}
      <FilterIcon field={filter.field} className="text-muted-foreground" />

      {/* Field name */}
      <span className="text-sm font-medium text-muted-foreground">
        {fieldLabel}
      </span>

      {/* Operator */}
      <span className="text-sm text-muted-foreground">{operatorLabel}</span>

      {/* Value - styled differently based on filter type */}
      {filter.field === "method" && Array.isArray(filter.value) ? (
        // Multiple method pills with individual colors
        <div className="inline-flex items-center gap-2 flex-wrap">
          {filter.value.slice(0, 3).map((methodValue) => (
            <ColorPill
              key={String(methodValue)}
              color={getMethodColor(String(methodValue))}
            >
              {String(methodValue)}
            </ColorPill>
          ))}
          {filter.value.length > 3 && (
            <span className="text-sm text-muted-foreground">
              +{filter.value.length - 3} more
            </span>
          )}
        </div>
      ) : shouldHighlightValue ? (
        // Single method pill with its specific color
        <ColorPill color={getMethodColor(String(filter.value))}>
          {value}
        </ColorPill>
      ) : (
        // Non-method fields - plain text
        <span className="text-sm font-mono text-foreground">{value}</span>
      )}

      {/* Remove button - Ghost icon button from design system */}
      <IconButton
        variant="ghost"
        size="icon-sm"
        icon={X}
        onClick={() => onRemove(filter.id)}
        aria-label={`Remove filter: ${label}`}
      />
    </div>
  );
}

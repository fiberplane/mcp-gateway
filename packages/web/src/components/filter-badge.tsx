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
  onEdit?: (filterId: string) => void;
  isNew?: boolean;
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
// Handles both single values and arrays
// For multi-value filters, shows count instead of truncating
function formatValue(filter: Filter): string {
  const formatSingleValue = (
    value: string | number,
    field: Filter["field"],
  ): string => {
    if (typeof value === "number") {
      return field === "duration" ? `${value}ms` : String(value);
    }
    return value;
  };

  // Handle array values
  if (Array.isArray(filter.value)) {
    const values = filter.value;

    // For multi-value filters (more than 1 item), show count
    // This makes it clear that editing is blocked for these
    if (values.length > 1) {
      return `(${values.length} values)`;
    }

    // Single item array - show the value
    if (values.length === 1 && values[0] !== undefined) {
      return formatSingleValue(values[0], filter.field);
    }

    // Empty array (shouldn't happen, but handle gracefully)
    return "(empty)";
  }

  // Handle single values
  return formatSingleValue(filter.value, filter.field);
}

export function FilterBadge({
  filter,
  onRemove,
  onEdit,
  isNew = false,
}: FilterBadgeProps) {
  const fieldLabel = FIELD_LABELS[filter.field];
  const operatorLabel = OPERATOR_LABELS[filter.operator] || filter.operator;
  const value = formatValue(filter);

  // Detect multi-value filters
  const isMultiValue = Array.isArray(filter.value) && filter.value.length > 1;

  // Method filters get a purple badge for the value (matching Figma)
  const shouldHighlightValue = filter.field === "method";

  // For multi-value methods, use "or" for better accessibility
  const label =
    filter.field === "method" && Array.isArray(filter.value)
      ? `${fieldLabel} ${operatorLabel} ${filter.value.join(" or ")}`
      : `${fieldLabel} ${operatorLabel} ${value}`;

  // Determine if editing is allowed
  const canEdit = onEdit && !isMultiValue;
  const editTooltip = isMultiValue
    ? "This filter has multiple values. Use the dropdown menu to edit."
    : canEdit
      ? `Edit filter (including operator: ${operatorLabel})`
      : undefined;

  // Remove animation class when animation completes
  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName === "filter-slide-in") {
      e.currentTarget.classList.remove("animate-filter-slide-in");
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 h-8 px-2 border border-foreground rounded-md bg-card",
        isNew && "animate-filter-slide-in",
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Clickable area for editing */}
      <button
        type="button"
        onClick={() => canEdit && onEdit(filter.id)}
        className={cn(
          "inline-flex items-center gap-2 transition-opacity",
          canEdit
            ? "hover:opacity-70 cursor-pointer"
            : "cursor-default opacity-100",
        )}
        disabled={!canEdit}
        aria-label={`Edit filter: ${label}`}
        title={editTooltip}
      >
        {/* Icon */}
        <FilterIcon field={filter.field} className="text-muted-foreground" />

        {/* Field name */}
        <span className="text-sm font-medium text-muted-foreground">
          {fieldLabel}
        </span>

        {/* Operator Badge */}
        <span
          className="text-xs italic text-foreground/70 underline decoration-dotted underline-offset-2"
          title={
            filter.operator === "is"
              ? "Exact match - only shows logs where the value matches exactly"
              : filter.operator === "contains"
                ? "Contains - shows logs where the value contains the search term"
                : undefined
          }
        >
          {operatorLabel}
        </span>

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
      </button>

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

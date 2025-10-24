/**
 * FilterBadge Component
 *
 * Displays an active filter as a badge with a remove button.
 *
 * Design Reference: https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-2812
 *
 * Features:
 * - Visual badge with filter label
 * - Remove button (X)
 * - Keyboard accessible (Tab + Enter)
 * - Screen reader friendly with ARIA labels
 * - Color variants based on filter type
 */

import type { Filter } from "@fiberplane/mcp-gateway-types";
import { X } from "lucide-react";
import { getFilterLabel } from "../lib/filter-utils";
import { Badge } from "./ui/badge";

interface FilterBadgeProps {
  filter: Filter;
  onRemove: (filterId: string) => void;
}

export function FilterBadge({ filter, onRemove }: FilterBadgeProps) {
  const label = getFilterLabel(filter);

  return (
    <Badge
      variant="info"
      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1"
      role="status"
      aria-label={`Active filter: ${label}`}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onRemove(filter.id)}
        className="inline-flex items-center justify-center rounded-sm hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 p-0.5 transition-colors"
        aria-label={`Remove filter: ${label}`}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}

/**
 * Displays an active search term as a removable pill.
 * Styled in gray to differentiate from filter pills.
 */

import type { SearchTerm } from "@fiberplane/mcp-gateway-types";
import { Search, X } from "lucide-react";
import { IconButton } from "./ui/button";

interface SearchPillProps {
  searchTerm: SearchTerm;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function SearchPill({ searchTerm, onRemove, onEdit }: SearchPillProps) {
  const label = `Search: ${searchTerm.query}`;

  return (
    <div className="inline-flex items-center gap-2 h-8 px-2 rounded-md bg-muted/50 border border-muted">
      {/* Clickable area for editing */}
      <button
        type="button"
        onClick={() => onEdit?.(searchTerm.id)}
        className="inline-flex items-center gap-2 hover:opacity-70 transition-opacity cursor-pointer disabled:cursor-default disabled:opacity-100"
        disabled={!onEdit}
        aria-label={`Edit search: ${label}`}
      >
        {/* Search icon */}
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />

        {/* Label */}
        <span className="text-sm text-muted-foreground">Search:</span>

        {/* Query text */}
        <span className="text-sm font-mono text-foreground">
          {searchTerm.query}
        </span>
      </button>

      {/* Remove button */}
      <IconButton
        variant="ghost"
        size="icon-sm"
        icon={X}
        onClick={() => onRemove(searchTerm.id)}
        aria-label={`Remove search: ${label}`}
      />
    </div>
  );
}

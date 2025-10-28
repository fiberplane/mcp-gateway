/**
 * SettingsMenu Component
 *
 * Dropdown menu for application settings and administrative actions.
 * Currently contains:
 * - Clear Sessions (destructive action)
 *
 * Features:
 * - Keyboard accessible
 * - Proper ARIA labels
 * - Destructive actions clearly marked
 */

import { Settings } from "lucide-react";
import * as DropdownMenu from "./ui/dropdown-menu";

interface SettingsMenuProps {
  onClearSessions: () => void;
  isClearing?: boolean;
}

export function SettingsMenu({
  onClearSessions,
  isClearing = false,
}: SettingsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="View settings"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item
            onSelect={onClearSessions}
            disabled={isClearing}
            className="text-destructive focus:text-destructive"
          >
            {isClearing ? "Clearing..." : "Clear Sessions..."}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

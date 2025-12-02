/**
 * Settings Dropdown Component
 *
 * Application settings dropdown menu
 */

import { Settings, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import * as DropdownMenu from "./ui/dropdown-menu";

interface SettingsDropdownProps {
  onClearSessions: () => void;
  isClearing?: boolean;
}

export function SettingsDropdown({
  onClearSessions,
  isClearing = false,
}: SettingsDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item
            onSelect={onClearSessions}
            disabled={isClearing}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? "Clearing..." : "Clear Sessions..."}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

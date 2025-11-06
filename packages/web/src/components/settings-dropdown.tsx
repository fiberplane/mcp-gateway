/**
 * Unified Settings Dropdown Component
 *
 * Combines server management and application settings into a single dropdown menu
 */

import { Plus, Server, Settings, Trash2 } from "lucide-react";
import { useServerModal } from "../contexts/ServerModalContext";
import { useServerConfigs } from "../hooks/use-server-configs";
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
  const { openAddServerModal, openEditServerModal } = useServerModal();

  // Fetch server configurations
  const { data: serversData, isLoading, isError, error } = useServerConfigs();

  const servers = serversData?.servers ?? [];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Label>Manage Servers</DropdownMenu.Label>
          <DropdownMenu.Item onClick={openAddServerModal}>
            <Plus className="w-4 h-4 text-muted-foreground" />
            Add Server
          </DropdownMenu.Item>

          {/* Server Management Section */}
          {isLoading ? (
            <DropdownMenu.Label>Loading servers...</DropdownMenu.Label>
          ) : isError ? (
            <DropdownMenu.Label className="text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load servers"}
            </DropdownMenu.Label>
          ) : servers.length === 0 ? (
            <DropdownMenu.Label className="text-muted-foreground">
              No servers
            </DropdownMenu.Label>
          ) : (
            servers.map((server) => (
              <DropdownMenu.Item
                key={server.name}
                onClick={() => openEditServerModal(server)}
              >
                <Server className="w-4 h-4 text-muted-foreground" />
                {server.name}
              </DropdownMenu.Item>
            ))
          )}
          <DropdownMenu.Separator />

          {/* Application Settings Section */}
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

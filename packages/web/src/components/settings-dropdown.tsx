/**
 * Unified Settings Dropdown Component
 *
 * Combines server management and application settings into a single dropdown menu
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Server, Settings, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useServerConfigs } from "../hooks/use-server-configs";
import { api } from "../lib/api";
import { ServerEditModal } from "./server-edit-modal";
import { Button } from "./ui/button";
import * as DropdownMenu from "./ui/dropdown-menu";

interface SettingsDropdownProps {
  onClearSessions: () => void;
  isClearing?: boolean;
  onAddServerClick?: () => void;
}

export function SettingsDropdown({
  onClearSessions,
  isClearing = false,
  onAddServerClick,
}: SettingsDropdownProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedServer, setSelectedServer] = useState<
    McpServerConfig | undefined
  >();

  // Fetch server configurations
  const { data: serversData, isLoading, isError, error } = useServerConfigs();

  // Add server mutation
  const addServerMutation = useMutation({
    mutationFn: (config: McpServerConfig) => api.addServer(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-configs"] });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      setModalOpen(false);
      setSelectedServer(undefined);
    },
  });

  // Update server mutation
  const updateServerMutation = useMutation({
    mutationFn: ({
      name,
      changes,
    }: {
      name: string;
      changes: Partial<Omit<McpServerConfig, "name" | "type">>;
    }) => api.updateServer(name, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-configs"] });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      setModalOpen(false);
      setSelectedServer(undefined);
    },
  });

  // Delete server mutation
  const deleteServerMutation = useMutation({
    mutationFn: (name: string) => api.deleteServer(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["server-configs"] });
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      setModalOpen(false);
      setSelectedServer(undefined);
    },
  });

  const handleAddClick = useCallback(() => {
    if (onAddServerClick) {
      onAddServerClick();
    } else {
      setModalMode("add");
      setSelectedServer(undefined);
      setModalOpen(true);
    }
  }, [onAddServerClick]);

  const handleEditClick = useCallback((server: McpServerConfig) => {
    setModalMode("edit");
    setSelectedServer(server);
    setModalOpen(true);
  }, []);

  const handleAddSubmit = useCallback(
    async (config: McpServerConfig) => {
      await addServerMutation.mutateAsync(config);
    },
    [addServerMutation],
  );

  const handleEditSubmit = useCallback(
    async (config: McpServerConfig) => {
      const { url, headers } = config;
      await updateServerMutation.mutateAsync({
        name: config.name,
        changes: { url, headers },
      });
    },
    [updateServerMutation],
  );

  const handleDelete = useCallback(
    async (config: McpServerConfig) => {
      await deleteServerMutation.mutateAsync(config.name);
    },
    [deleteServerMutation],
  );

  const servers = serversData?.servers ?? [];

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Label>Manage Servers</DropdownMenu.Label>
            <DropdownMenu.Item onClick={handleAddClick}>
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
                  onClick={() => handleEditClick(server)}
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

      {/* Modal */}
      {modalOpen && (
        <ServerEditModal
          mode={modalMode}
          initialData={selectedServer}
          onSubmit={modalMode === "add" ? handleAddSubmit : handleEditSubmit}
          onClose={() => {
            setModalOpen(false);
            setSelectedServer(undefined);
          }}
          onDelete={modalMode === "edit" ? handleDelete : undefined}
          isSubmitting={
            addServerMutation.isPending ||
            updateServerMutation.isPending ||
            deleteServerMutation.isPending
          }
        />
      )}
    </>
  );
}

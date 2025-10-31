/**
 * Server Management Dropdown Component
 *
 * Dropdown menu for managing servers (add/edit/delete)
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "../lib/api";
import { ServerEditModal } from "./server-edit-modal";
import { Button } from "./ui/button";
import * as DropdownMenu from "./ui/dropdown-menu";

export function ServerManagementDropdown() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedServer, setSelectedServer] = useState<
    McpServerConfig | undefined
  >();

  // Fetch server configurations
  const {
    data: serversData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["server-configs"],
    queryFn: () => api.getServerConfigs(),
  });

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
    setModalMode("add");
    setSelectedServer(undefined);
    setModalOpen(true);
  }, []);

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
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Manage Servers
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end">
            {isLoading ? (
              <DropdownMenu.Label>Loading...</DropdownMenu.Label>
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
              <>
                <DropdownMenu.Label>Edit Server</DropdownMenu.Label>
                {servers.map((server) => (
                  <DropdownMenu.Item
                    key={server.name}
                    onClick={() => handleEditClick(server)}
                  >
                    {server.name}
                  </DropdownMenu.Item>
                ))}
              </>
            )}

            <DropdownMenu.Separator />

            <DropdownMenu.Item onClick={handleAddClick}>
              <Plus className="w-4 h-4" />
              Add Server
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

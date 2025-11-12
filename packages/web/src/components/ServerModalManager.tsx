/**
 * Server Modal Manager Component
 *
 * Centralized modal state management and rendering for server add/edit modals
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useApi } from "../contexts/ApiContext";
import { ServerModalContext } from "../contexts/ServerModalContext";
import { ServerEditModal } from "./server-edit-modal";

interface ServerModalManagerProps {
  children: React.ReactNode;
}

export function ServerModalManager({ children }: ServerModalManagerProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedServer, setSelectedServer] = useState<
    McpServerConfig | undefined
  >();

  // Add server mutation
  const addServerMutation = useMutation({
    mutationFn: (config: McpServerConfig) => api.addServer(config),
    onSuccess: async () => {
      // Wait for queries to invalidate before closing modal
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["server-configs"] }),
        queryClient.invalidateQueries({ queryKey: ["servers"] }),
      ]);
      // Wait one more tick for UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
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
    onSuccess: async () => {
      // Wait for queries to invalidate before closing modal
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["server-configs"] }),
        queryClient.invalidateQueries({ queryKey: ["servers"] }),
      ]);
      // Wait one more tick for UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
      setModalOpen(false);
      setSelectedServer(undefined);
    },
  });

  // Delete server mutation
  const deleteServerMutation = useMutation({
    mutationFn: (name: string) => api.deleteServer(name),
    onSuccess: async () => {
      // Wait for queries to invalidate before closing modal
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["server-configs"] }),
        queryClient.invalidateQueries({ queryKey: ["servers"] }),
      ]);
      // Wait one more tick for UI to update
      await new Promise((resolve) => setTimeout(resolve, 0));
      setModalOpen(false);
      setSelectedServer(undefined);
    },
  });

  const openAddServerModal = useCallback(() => {
    setModalMode("add");
    setSelectedServer(undefined);
    setModalOpen(true);
  }, []);

  const openEditServerModal = useCallback((server: McpServerConfig) => {
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

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setSelectedServer(undefined);
  }, []);

  const contextValue = useMemo(
    () => ({
      openAddServerModal,
      openEditServerModal,
    }),
    [openAddServerModal, openEditServerModal],
  );

  return (
    <ServerModalContext.Provider value={contextValue}>
      {children}

      {/* Modal */}
      {modalOpen && (
        <ServerEditModal
          mode={modalMode}
          initialData={selectedServer}
          onSubmit={modalMode === "add" ? handleAddSubmit : handleEditSubmit}
          onClose={handleClose}
          onDelete={modalMode === "edit" ? handleDelete : undefined}
          isSubmitting={
            addServerMutation.isPending ||
            updateServerMutation.isPending ||
            deleteServerMutation.isPending
          }
        />
      )}
    </ServerModalContext.Provider>
  );
}

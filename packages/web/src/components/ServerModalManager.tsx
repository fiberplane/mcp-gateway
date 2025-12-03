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

/**
 * Discriminated union for modal state
 * - Closed: no data needed
 * - Add mode: optional partial config for pre-filling
 * - Edit mode: full config required
 */
type ModalState =
  | { isOpen: false }
  | { isOpen: true; mode: "add"; data?: Partial<McpServerConfig> }
  | { isOpen: true; mode: "edit"; data: McpServerConfig };

export function ServerModalManager({ children }: ServerModalManagerProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });

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
      setModalState({ isOpen: false });
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
      setModalState({ isOpen: false });
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
      setModalState({ isOpen: false });
    },
  });

  const openAddServerModal = useCallback(
    (initialData?: Partial<McpServerConfig>) => {
      setModalState({ isOpen: true, mode: "add", data: initialData });
    },
    [],
  );

  const openEditServerModal = useCallback((server: McpServerConfig) => {
    setModalState({ isOpen: true, mode: "edit", data: server });
  }, []);

  const handleAddSubmit = useCallback(
    async (config: McpServerConfig) => {
      await addServerMutation.mutateAsync(config);
    },
    [addServerMutation],
  );

  const handleEditSubmit = useCallback(
    async (config: McpServerConfig) => {
      if (config.type === "http") {
        const { url, headers } = config;
        await updateServerMutation.mutateAsync({
          name: config.name,
          changes: { url, headers },
        });
      } else {
        const { command, args, env, cwd, timeout, sessionMode } = config;
        await updateServerMutation.mutateAsync({
          name: config.name,
          changes: { command, args, env, cwd, timeout, sessionMode },
        });
      }
    },
    [updateServerMutation],
  );

  const handleDelete = useCallback(
    async (config: Partial<McpServerConfig> & { name: string }) => {
      await deleteServerMutation.mutateAsync(config.name);
    },
    [deleteServerMutation],
  );

  const handleClose = useCallback(() => {
    setModalState({ isOpen: false });
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

      {/* Modal - TypeScript knows: if mode="edit", data is McpServerConfig */}
      {modalState.isOpen && (
        <ServerEditModal
          mode={modalState.mode}
          initialData={modalState.data}
          onSubmit={
            modalState.mode === "add" ? handleAddSubmit : handleEditSubmit
          }
          onClose={handleClose}
          onDelete={modalState.mode === "edit" ? handleDelete : undefined}
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

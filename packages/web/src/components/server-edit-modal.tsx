/**
 * Server Edit Modal Component
 *
 * Modal wrapper for ServerForm supporting add and edit modes
 * Uses Radix Dialog for accessibility (focus trap, escape handling, focus restore)
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useConfirm } from "../hooks/use-confirm";
import { ServerForm } from "./server-form";
import { Button } from "./ui/button";

interface ServerEditModalProps {
  /**
   * Modal mode: "add" or "edit"
   */
  mode: "add" | "edit";
  /**
   * Initial server data (partial for add mode, full for edit mode)
   */
  initialData?: Partial<McpServerConfig>;
  /**
   * Callback when form is submitted
   */
  onSubmit: (config: McpServerConfig) => Promise<void>;
  /**
   * Callback when modal is closed
   */
  onClose: () => void;
  /**
   * Callback when delete is requested (edit mode only)
   * Receives partial config but name is guaranteed in edit mode
   */
  onDelete?: (
    config: Partial<McpServerConfig> & { name: string },
  ) => Promise<void>;
  /**
   * Whether form is currently submitting
   */
  isSubmitting?: boolean;
}

export function ServerEditModal({
  mode,
  initialData,
  onSubmit,
  onClose,
  onDelete,
  isSubmitting = false,
}: ServerEditModalProps) {
  const { confirm, ConfirmDialog } = useConfirm();

  const handleDelete = async () => {
    const name = initialData?.name;
    if (!name || !onDelete) return;

    const confirmed = await confirm({
      title: "Delete Server",
      description: `Are you sure you want to delete server "${name}"?\n\nNote: Associated logs will be preserved for historical analysis.\n\nThis action cannot be undone.`,
      confirmText: "Delete Server",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) return;

    await onDelete({ ...initialData, name });
  };

  // Handle open change - only allow closing when not submitting
  const handleOpenChange = (open: boolean) => {
    if (!open && !isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-foreground/50 z-50 animate-fade-in" />

        {/* Content - centered using Radix-native positioning */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-lg border border-border max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto z-50 animate-scale-in"
          aria-busy={isSubmitting}
        >
          {/* Visually hidden description for screen readers */}
          <Dialog.Description className="sr-only">
            {mode === "add"
              ? "Form to add a new MCP server configuration"
              : `Form to edit the ${initialData?.name} server configuration`}
          </Dialog.Description>

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <Dialog.Title className="text-xl font-semibold text-foreground">
              {mode === "add"
                ? "Add Server"
                : `Edit Server: ${initialData?.name}`}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <div className="p-6">
            <ServerForm
              mode={mode}
              initialData={initialData}
              onSubmit={onSubmit}
              onCancel={onClose}
              onDelete={onDelete ? handleDelete : undefined}
              isSubmitting={isSubmitting}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      {ConfirmDialog}
    </Dialog.Root>
  );
}

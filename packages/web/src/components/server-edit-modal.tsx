/**
 * Server Edit Modal Component
 *
 * Modal wrapper for ServerForm supporting add and edit modes
 */

import type { McpServerConfig } from "@fiberplane/mcp-gateway-types";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../hooks/use-focus-trap";
import { ServerForm } from "./server-form";
import { Button } from "./ui/button";

interface ServerEditModalProps {
  /**
   * Modal mode: "add" or "edit"
   */
  mode: "add" | "edit";
  /**
   * Initial server data (for edit mode)
   */
  initialData?: McpServerConfig;
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
   */
  onDelete?: (config: McpServerConfig) => Promise<void>;
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
  // Store the element that had focus before modal opened
  const previousFocusRef = useRef<HTMLElement | null>(null);
  // Focus trap for modal content
  const modalRef = useFocusTrap<HTMLDivElement>(true);
  // Unique ID for heading (for aria-labelledby)
  const headingId = useId();

  // Capture focus on mount and restore on unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // Restore focus when modal unmounts
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, isSubmitting]);

  const handleDelete = async () => {
    if (!initialData || !onDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete server "${initialData.name}"?\n\nNote: Associated logs will be preserved for historical analysis.\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    await onDelete(initialData);
  };

  return (
    <>
      {/* Modal overlay - click outside to close */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Modal overlay with click-outside-to-close is standard UX pattern */}
      <div
        className="fixed inset-0 bg-foreground/50 z-50 animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !isSubmitting) {
            onClose();
          }
        }}
      >
        {/* Center container for modal */}
        <div className="flex items-center justify-center min-h-screen p-4">
          {/* Modal content */}
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            className="bg-card rounded-lg border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2
                id={headingId}
                className="text-xl font-semibold text-foreground"
              >
                {mode === "add"
                  ? "Add Server"
                  : `Edit Server: ${initialData?.name}`}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </Button>
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
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * EmptyState Component
 *
 * Displays a centered message for empty states with optional icon and action.
 *
 * @example
 * ```tsx
 * <EmptyState message="No logs found" />
 * <EmptyState
 *   icon={Search}
 *   message="No results found"
 *   action={<Button>Clear filters</Button>}
 * />
 * ```
 */

import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional icon to display above the message
   */
  icon?: LucideIcon;

  /**
   * Message to display
   */
  message: string;

  /**
   * Optional action button or element to display below the message
   */
  action?: React.ReactNode;
}

/**
 * EmptyState Component
 *
 * A centered message for empty states with optional icon and action.
 * Provides consistent styling for "no data" scenarios.
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon: Icon, message, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-3 px-2 py-8 text-center",
          className,
        )}
        {...props}
      >
        {Icon && (
          <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  },
);
EmptyState.displayName = "EmptyState";

export { EmptyState };

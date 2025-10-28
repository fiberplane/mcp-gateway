/**
 * LoadingIndicator Component
 *
 * Simple loading indicator with customizable message and layout.
 * Provides consistent styling for loading states across the application.
 *
 * Features:
 * - Customizable message
 * - Size variants (sm, md, lg)
 * - Inline or block layout
 * - Muted text styling
 *
 * @example
 * ```tsx
 * <LoadingIndicator />
 * <LoadingIndicator message="Loading data..." />
 * <LoadingIndicator size="sm" inline />
 * ```
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const loadingIndicatorVariants = cva("text-muted-foreground", {
  variants: {
    size: {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    },
    inline: {
      true: "inline",
      false: "block text-center",
    },
  },
  defaultVariants: {
    size: "md",
    inline: false,
  },
});

export interface LoadingIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingIndicatorVariants> {
  /**
   * Loading message to display
   */
  message?: string;
}

/**
 * LoadingIndicator Component
 *
 * A simple loading indicator with consistent styling.
 * Use inline prop for inline loading states, or default for centered block layout.
 */
const LoadingIndicator = React.forwardRef<
  HTMLDivElement,
  LoadingIndicatorProps
>(({ className, size, inline, message = "Loading...", ...props }, ref) => {
  return (
    // biome-ignore lint/a11y/useSemanticElements: div with role="status" is semantically correct for loading states
    <div
      ref={ref}
      className={cn(
        loadingIndicatorVariants({ size, inline, className }),
        !inline && "px-2 py-8",
      )}
      role="status"
      aria-live="polite"
      {...props}
    >
      {message}
    </div>
  );
});
LoadingIndicator.displayName = "LoadingIndicator";

export { LoadingIndicator, loadingIndicatorVariants };

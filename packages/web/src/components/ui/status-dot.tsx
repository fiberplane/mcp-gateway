/**
 * StatusDot Component
 *
 * Small colored dot for indicating status with optional pulse animation.
 *
 * @example
 * ```tsx
 * <StatusDot variant="success" animate={true} aria-label="Online" />
 * <StatusDot variant="error" aria-label="Offline" />
 * ```
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const statusDotVariants = cva("w-2 h-2 rounded-full", {
  variants: {
    variant: {
      success: "bg-status-success",
      error: "bg-status-error",
      warning: "bg-status-warning",
      neutral: "bg-status-neutral",
    },
    animate: {
      true: "animate-pulse",
      false: "",
    },
  },
  defaultVariants: {
    variant: "neutral",
    animate: false,
  },
});

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {
  /**
   * Optional accessible label for screen readers
   * If provided, removes aria-hidden
   */
  "aria-label"?: string;
}

/**
 * StatusDot Component
 *
 * A small colored dot for indicating status with consistent styling.
 * Use aria-label to provide accessible status information.
 */
const StatusDot = React.forwardRef<
  HTMLSpanElement | HTMLDivElement,
  StatusDotProps
>(({ className, variant, animate, "aria-label": ariaLabel, ...props }, ref) => {
  if (ariaLabel) {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="img"
        className={cn(statusDotVariants({ variant, animate, className }))}
        aria-label={ariaLabel}
        {...props}
      />
    );
  }

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      className={cn(statusDotVariants({ variant, animate, className }))}
      aria-hidden="true"
      {...props}
    />
  );
});
StatusDot.displayName = "StatusDot";

export { StatusDot, statusDotVariants };

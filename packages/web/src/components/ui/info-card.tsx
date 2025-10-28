/**
 * InfoCard Component
 *
 * Displays a label-value pair with consistent styling.
 *
 * @example
 * ```tsx
 * <InfoCard label="Session ID" value="abc123..." />
 * <InfoCard label="Method" value="tools/call" variant="code" />
 * ```
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const infoCardVariants = cva(
  "flex flex-col gap-1 p-2 border border-border rounded-md bg-card",
  {
    variants: {
      variant: {
        default: "",
        code: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface InfoCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof infoCardVariants> {
  /**
   * Label text (will be displayed in uppercase)
   */
  label: string;

  /**
   * Value to display
   */
  value: React.ReactNode;
}

/**
 * InfoCard Component
 *
 * A card displaying a label-value pair with consistent styling.
 * Use the "code" variant for monospace values like IDs and method names.
 */
const InfoCard = React.forwardRef<HTMLDivElement, InfoCardProps>(
  ({ className, variant, label, value, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(infoCardVariants({ variant, className }))}
        {...props}
      >
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </span>
        <span
          className={cn(
            "text-sm text-foreground break-all",
            variant === "code" && "font-mono",
          )}
        >
          {value}
        </span>
      </div>
    );
  },
);
InfoCard.displayName = "InfoCard";

export { InfoCard, infoCardVariants };

/**
 * ColorPill Component
 *
 * Pill-shaped badge with dynamic background color.
 * Used for method names, tags, and other color-coded content.
 *
 * Features:
 * - Dynamic background color via CSS variable or hex
 * - Consistent padding and border radius
 * - Optional icon support
 * - Monospace text for code-like content
 *
 * @example
 * ```tsx
 * <ColorPill color="#ff6b6b">GET</ColorPill>
 * <ColorPill color={getMethodColor("tools/call")}>
 *   tools/call
 * </ColorPill>
 * ```
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ColorPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Background color (hex, rgb, or CSS variable)
   */
  color: string;

  /**
   * Optional icon to display before text
   */
  icon?: React.ReactNode;

  /**
   * Content to display in the pill
   */
  children: React.ReactNode;
}

/**
 * ColorPill Component
 *
 * A pill-shaped badge with customizable background color.
 * Automatically applies monospace font for code-like content.
 */
const ColorPill = React.forwardRef<HTMLDivElement, ColorPillProps>(
  ({ className, color, icon, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded-md",
          className,
        )}
        style={{
          backgroundColor: color,
          ...style,
        }}
        {...props}
      >
        {icon}
        <span className="text-sm font-mono text-foreground">{children}</span>
      </div>
    );
  },
);
ColorPill.displayName = "ColorPill";

export { ColorPill };

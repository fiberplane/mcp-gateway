/**
 * Kbd Component
 *
 * Displays keyboard keys or shortcuts with consistent styling.
 *
 * @example
 * ```tsx
 * <Kbd>Escape</Kbd>
 * <Kbd>⌘K</Kbd>
 * <span>Press <Kbd>Enter</Kbd> to submit</span>
 * ```
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Keyboard key or shortcut to display
   */
  children: React.ReactNode;
}

/**
 * Kbd Component
 *
 * A styled keyboard key representation for hints and documentation.
 * Uses the semantic <kbd> element for proper accessibility.
 */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center px-1.5 py-0.5",
          "text-xs font-mono font-medium",
          "bg-muted text-muted-foreground",
          "border border-border rounded",
          "shadow-sm",
          className,
        )}
        {...props}
      >
        {children}
      </kbd>
    );
  },
);
Kbd.displayName = "Kbd";

export { Kbd };

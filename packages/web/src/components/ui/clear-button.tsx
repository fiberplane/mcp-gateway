/**
 * ClearButton Component
 *
 * Specialized button for clear/remove actions with consistent styling.
 * Built on top of IconButton with X icon and ghost variant.
 *
 * Features:
 * - Consistent X icon
 * - Ghost/transparent styling
 * - Hover states
 * - Focus rings
 * - Type-safe with required aria-label
 *
 * @example
 * ```tsx
 * <ClearButton
 *   onClear={() => setValue("")}
 *   aria-label="Clear search"
 * />
 * ```
 */

import { X } from "lucide-react";
import * as React from "react";

import { IconButton, type IconButtonProps } from "./button";

interface ClearButtonProps extends Omit<IconButtonProps, "icon"> {
  /**
   * Callback when clear button is clicked
   */
  onClear?: () => void;
}

/**
 * ClearButton Component
 *
 * A specialized IconButton for clear/remove actions.
 * Always uses the X icon and ghost variant for consistency.
 */
const ClearButton = React.forwardRef<HTMLButtonElement, ClearButtonProps>(
  ({ onClear, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClear?.();
      onClick?.(e);
    };

    return (
      <IconButton
        ref={ref}
        icon={X}
        variant="ghost"
        onClick={handleClick}
        {...props}
      />
    );
  },
);
ClearButton.displayName = "ClearButton";

export { ClearButton };
export type { ClearButtonProps };

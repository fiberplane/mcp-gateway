/**
 * InputWithIcon Component
 *
 * Input field with optional left icon and right action slot.
 *
 * @example
 * ```tsx
 * <InputWithIcon
 *   leftIcon={Search}
 *   rightAction={<ClearButton onClear={() => {}} aria-label="Clear" />}
 *   placeholder="Search..."
 * />
 * ```
 */

import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

interface InputWithIconProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  /**
   * Optional icon to display on the left side
   */
  leftIcon?: LucideIcon;

  /**
   * Optional action element to display on the right side
   * (e.g., clear button, submit button)
   */
  rightAction?: React.ReactNode;

  /**
   * Optional className for the container div
   */
  containerClassName?: string;

  /**
   * Optional className for the input element
   */
  inputClassName?: string;
}

/**
 * InputWithIcon Component
 *
 * A flexible input field with optional left icon and right action slot.
 * Automatically adjusts padding based on which slots are filled.
 */
const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  (
    {
      leftIcon: LeftIcon,
      rightAction,
      containerClassName,
      inputClassName,
      ...inputProps
    },
    ref,
  ) => {
    return (
      <div className={cn("relative flex items-center", containerClassName)}>
        {LeftIcon && (
          <LeftIcon
            className="absolute left-3 size-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
        )}

        <input
          ref={ref}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:border-ring transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            LeftIcon ? "pl-9" : "pl-3",
            rightAction ? "pr-9" : "pr-3",
            inputClassName,
          )}
          {...inputProps}
        />

        {rightAction && <div className="absolute right-2">{rightAction}</div>}
      </div>
    );
  },
);
InputWithIcon.displayName = "InputWithIcon";

export { InputWithIcon };
export type { InputWithIconProps };

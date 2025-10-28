/**
 * CopyButton Component
 *
 * Button that copies content to clipboard with visual feedback.
 * Shows "Copy" → "Copied" transition with icon change.
 *
 * Features:
 * - Automatic clipboard copying
 * - Visual feedback (icon + text transition)
 * - Success state with timeout
 * - Accessible with proper ARIA labels
 *
 * @example
 * ```tsx
 * <CopyButton value={JSON.stringify(data)} />
 * <CopyButton value={sessionId} onCopy={() => console.log('Copied!')} />
 * ```
 */

import { Check, Copy } from "lucide-react";
import * as React from "react";

import { Button, type ButtonProps } from "./button";

export interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  /**
   * Content to copy to clipboard
   */
  value: string;

  /**
   * Optional callback after successful copy
   */
  onCopy?: () => void;

  /**
   * Duration in ms to show "Copied" state (default: 2000)
   */
  successDuration?: number;
}

/**
 * CopyButton Component
 *
 * A button that copies content to the clipboard and shows success feedback.
 * Automatically resets to "Copy" state after a timeout.
 */
const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      onCopy,
      successDuration = 2000,
      variant = "outline",
      size = "sm",
      children,
      ...props
    },
    ref,
  ) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopy?.();

        // Reset after timeout
        setTimeout(() => {
          setCopied(false);
        }, successDuration);
      } catch {
        // Silently fail - clipboard access may be denied
        // Component will show "Copy" state indicating no action was taken
      }
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        onClick={handleCopy}
        disabled={copied}
        {...props}
      >
        {copied ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            {children || "Copied"}
          </>
        ) : (
          <>
            <Copy className="size-4" aria-hidden="true" />
            {children || "Copy"}
          </>
        )}
      </Button>
    );
  },
);
CopyButton.displayName = "CopyButton";

export { CopyButton };

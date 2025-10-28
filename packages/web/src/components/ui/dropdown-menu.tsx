/**
 * DropdownMenu UI Component
 *
 * Styled wrapper around Radix UI DropdownMenu with consistent design system styling.
 * Provides a compound component API for building dropdown menus with items, checkboxes, and submenus.
 *
 * Features:
 * - Consistent styling across all dropdown menus
 * - Support for items, checkbox items, and nested submenus
 * - Keyboard accessible
 * - Screen reader friendly
 * - Follows Radix UI composition patterns
 *
 * @example
 * ```tsx
 * <DropdownMenu.Root>
 *   <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
 *   <DropdownMenu.Portal>
 *     <DropdownMenu.Content>
 *       <DropdownMenu.Item onSelect={() => {}}>Action</DropdownMenu.Item>
 *       <DropdownMenu.Separator />
 *       <DropdownMenu.CheckboxItem checked={true}>Option</DropdownMenu.CheckboxItem>
 *       <DropdownMenu.Sub>
 *         <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
 *         <DropdownMenu.SubContent>
 *           <DropdownMenu.Item>Nested item</DropdownMenu.Item>
 *         </DropdownMenu.SubContent>
 *       </DropdownMenu.Sub>
 *     </DropdownMenu.Content>
 *   </DropdownMenu.Portal>
 * </DropdownMenu.Root>
 * ```
 */

import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import * as React from "react";

import { cn } from "@/lib/utils";

// Re-export Root and Portal as-is
const Root = RadixDropdownMenu.Root;
const Portal = RadixDropdownMenu.Portal;
const Sub = RadixDropdownMenu.Sub;

// Trigger - typically a button, no default styling
const Trigger = RadixDropdownMenu.Trigger;

// Content - main dropdown container
const Content = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>
>(({ className, sideOffset = 5, ...props }, ref) => (
  <RadixDropdownMenu.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-lg",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
      "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
Content.displayName = "DropdownMenuContent";

// SubContent - submenu container
const SubContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubContent>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubContent>
>(({ className, sideOffset = 2, alignOffset = -5, ...props }, ref) => (
  <RadixDropdownMenu.SubContent
    ref={ref}
    sideOffset={sideOffset}
    alignOffset={alignOffset}
    className={cn(
      "min-w-[220px] max-w-[320px] max-h-[400px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
      "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
SubContent.displayName = "DropdownMenuSubContent";

// Item - clickable menu item
const Item = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Item
    ref={ref}
    className={cn(
      "flex items-center gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer",
      "hover:bg-accent rounded-sm transition-colors",
      "focus:bg-accent",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
Item.displayName = "DropdownMenuItem";

// CheckboxItem - item with checkbox
const CheckboxItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.CheckboxItem>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.CheckboxItem
    ref={ref}
    className={cn(
      "flex items-center gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer",
      "hover:bg-accent rounded-sm transition-colors",
      "focus:bg-accent",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
CheckboxItem.displayName = "DropdownMenuCheckboxItem";

// SubTrigger - opens a submenu
const SubTrigger = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubTrigger>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.SubTrigger
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer",
      "hover:bg-accent rounded-sm transition-colors",
      "focus:bg-accent",
      "data-[state=open]:bg-accent",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
SubTrigger.displayName = "DropdownMenuSubTrigger";

// Separator - visual divider
const Separator = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Separator
    ref={ref}
    className={cn("h-px bg-border my-1", className)}
    {...props}
  />
));
Separator.displayName = "DropdownMenuSeparator";

// Export all components
export {
  Root,
  Trigger,
  Portal,
  Content,
  Item,
  CheckboxItem,
  Separator,
  Sub,
  SubTrigger,
  SubContent,
};

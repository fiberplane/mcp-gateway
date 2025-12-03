import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

type NavBarItemAsChildProps = {
  asChild: true;
  isActive?: boolean;
} & ComponentPropsWithoutRef<typeof Slot>;

type NavBarItemAsAnchorProps = {
  asChild?: false;
  isActive?: boolean;
} & ComponentPropsWithoutRef<"a">;

export type NavBarItemProps = NavBarItemAsChildProps | NavBarItemAsAnchorProps;

export const NavBarItem = forwardRef<HTMLElement, NavBarItemProps>(
  (
    { asChild = false, isActive = false, className, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "a";

    return (
      <Comp
        ref={ref as never}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-normal leading-5 w-full",
          "transition-colors",
          "text-muted-foreground",
          "hover:bg-secondary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isActive && "bg-secondary text-foreground",
          "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
          "cursor-pointer",
          className,
        )}
        aria-current={isActive ? "page" : undefined}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

NavBarItem.displayName = "NavBarItem";

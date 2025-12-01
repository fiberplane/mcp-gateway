import type { ReactNode } from "react";

interface PageLayoutProps {
  /** Icon to display in the breadcrumb area */
  icon: ReactNode;
  /** Breadcrumb text (e.g., "Marketplace", "Servers") */
  breadcrumb: string;
  /** Page content */
  children: ReactNode;
}

/**
 * PageLayout provides consistent page structure matching Figma design:
 * - White content card with border and rounded corners
 * - Top navigation bar with breadcrumb
 * - Proper padding and spacing
 */
export function PageLayout({ icon, breadcrumb, children }: PageLayoutProps) {
  return (
    <div className="flex flex-col gap-2 h-full p-2 pl-0">
      {/* White content card with border, rounded corners, and drop shadow */}
      <div className="flex-1 bg-card border border-border rounded-[14px] overflow-hidden flex flex-col shadow-card">
        {/* Top navigation bar with breadcrumb */}
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-sm text-muted-foreground">{breadcrumb}</span>
          </div>
        </div>

        {/* Page content area */}
        <div className="flex-1 overflow-auto px-10 pt-4 pb-5">{children}</div>
      </div>
    </div>
  );
}

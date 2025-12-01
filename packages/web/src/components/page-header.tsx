import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Page title (H2 - 20px, medium weight) */
  title: string;
  /** Page description (14px, muted foreground) */
  description?: string;
  /** Optional actions to render on the right side */
  actions?: ReactNode;
}

/**
 * PageHeader provides consistent page header structure matching Figma design:
 * - Title (20px, medium weight)
 * - Description (14px, muted)
 * - Actions slot on the right
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between py-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-medium leading-6 text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

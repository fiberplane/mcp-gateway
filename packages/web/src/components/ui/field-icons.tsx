/**
 * Shared icon mapping for filter fields and table columns.
 * Used across filter dropdowns, table headers, and other UI components.
 */

import type { LucideProps } from "lucide-react";
import {
  Clock,
  Network,
  Server,
  Terminal,
  Timer,
  UserCircle,
} from "lucide-react";

/**
 * Field type used throughout the application
 */
export type FieldType =
  | "method"
  | "session"
  | "client"
  | "server"
  | "timestamp"
  | "duration";

/**
 * CategoryIcon Component
 *
 * Renders the appropriate icon for a given category/field type.
 *
 * @example
 * ```tsx
 * <CategoryIcon category="server" className="size-4" />
 * <CategoryIcon category="method" aria-hidden="true" />
 * ```
 */
export function CategoryIcon({
  category,
  ...props
}: { category: FieldType } & LucideProps) {
  switch (category) {
    case "method":
      return <Terminal {...props} />;
    case "session":
      return <Network {...props} />;
    case "client":
      return <UserCircle {...props} />;
    case "server":
      return <Server {...props} />;
    case "timestamp":
      return <Clock {...props} />;
    case "duration":
      return <Timer {...props} />;
  }
}

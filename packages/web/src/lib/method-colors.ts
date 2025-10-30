/**
 * Method color mapping for visual consistency in the UI
 *
 * These colors match the design system and provide visual distinction
 * between different MCP method types in badges, filters, and logs.
 *
 * Colors are defined as CSS variables in index.css to support theming.
 * Color palette derived from Figma design:
 * https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-3266
 */

/**
 * Method color categories
 */
export const METHOD_COLORS = {
  // Initialization and lifecycle methods (purple)
  initialize: "var(--color-method-init)",
  ping: "var(--color-method-init)",

  // Resource methods (peach/salmon)
  "resources/list": "var(--color-method-resource)",
  "resources/read": "var(--color-method-resource)",
  "resources/templates/list": "var(--color-method-resource)",
  "resources/subscribe": "var(--color-method-resource)",
  "resources/unsubscribe": "var(--color-method-resource)",

  // Tool methods (yellow)
  "tools/list": "var(--color-method-tool)",
  "tools/call": "var(--color-method-tool)",

  // Prompt methods (lime)
  "prompts/list": "var(--color-method-prompt)",
  "prompts/get": "var(--color-method-prompt)",

  // Notification methods (pink)
  "notifications/initialized": "var(--color-method-notification)",
  "notifications/message": "var(--color-method-notification)",
  "notifications/progress": "var(--color-method-notification)",
  "notifications/cancelled": "var(--color-method-notification)",
  "notifications/tools/list_changed": "var(--color-method-notification)",
  "notifications/resources/list_changed": "var(--color-method-notification)",
  "notifications/resources/updated": "var(--color-method-notification)",
  "notifications/prompts/list_changed": "var(--color-method-notification)",
} as const;

/**
 * Default color for methods not in the predefined list
 */
export const DEFAULT_METHOD_COLOR = "var(--color-method-default)";

/**
 * Type guard to check if a method is a known method with a predefined color
 */
function isKnownMethod(method: string): method is keyof typeof METHOD_COLORS {
  return method in METHOD_COLORS;
}

/**
 * Get the color for a method name
 *
 * @param method - The method name (e.g., "tools/call", "initialize")
 * @returns Hex color code
 *
 * @example
 * getMethodColor("tools/call") // Returns "#f7dd91" (yellow)
 * getMethodColor("custom/method") // Returns "#e5e7eb" (gray)
 */
export function getMethodColor(method: string): string {
  return isKnownMethod(method) ? METHOD_COLORS[method] : DEFAULT_METHOD_COLOR;
}

/**
 * Get all unique method categories with their colors
 *
 * @returns Array of category objects with name and color
 */
export function getMethodCategories() {
  return [
    { name: "Initialization", color: "var(--color-method-init)" },
    { name: "Resources", color: "var(--color-method-resource)" },
    { name: "Tools", color: "var(--color-method-tool)" },
    { name: "Prompts", color: "var(--color-method-prompt)" },
    { name: "Notifications", color: "var(--color-method-notification)" },
    { name: "Other", color: DEFAULT_METHOD_COLOR },
  ];
}

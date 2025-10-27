/**
 * Method color mapping for visual consistency in the UI
 *
 * These colors match the design system and provide visual distinction
 * between different MCP method types in badges, filters, and logs.
 *
 * Color palette derived from Figma design:
 * https://www.figma.com/design/sVRANvfGiWr6CJhpXCI02W/MCP-gateway---playground?node-id=216-3266
 */

/**
 * Method color categories
 */
export const METHOD_COLORS = {
  // Initialization and lifecycle methods (purple)
  initialize: "#dddbff",
  ping: "#dddbff",

  // Resource methods (peach/salmon)
  "resources/list": "#ffe6e0",
  "resources/read": "#ffe6e0",
  "resources/templates/list": "#ffe6e0",
  "resources/subscribe": "#ffe6e0",
  "resources/unsubscribe": "#ffe6e0",

  // Tool methods (yellow)
  "tools/list": "#f7dd91",
  "tools/call": "#f7dd91",

  // Prompt methods (green)
  "prompts/list": "#d1eaac",
  "prompts/get": "#d1eaac",

  // Notification methods (pink)
  "notifications/initialized": "#f8d2e8",
  "notifications/message": "#f8d2e8",
  "notifications/progress": "#f8d2e8",
  "notifications/cancelled": "#f8d2e8",
  "notifications/tools/list_changed": "#f8d2e8",
  "notifications/resources/list_changed": "#f8d2e8",
  "notifications/resources/updated": "#f8d2e8",
  "notifications/prompts/list_changed": "#f8d2e8",
} as const;

/**
 * Default color for methods not in the predefined list
 */
export const DEFAULT_METHOD_COLOR = "#e5e7eb"; // neutral gray

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
  return (
    METHOD_COLORS[method as keyof typeof METHOD_COLORS] ?? DEFAULT_METHOD_COLOR
  );
}

/**
 * Get all unique method categories with their colors
 *
 * @returns Array of category objects with name and color
 */
export function getMethodCategories() {
  return [
    { name: "Initialization", color: "#dddbff" },
    { name: "Resources", color: "#ffe6e0" },
    { name: "Tools", color: "#f7dd91" },
    { name: "Prompts", color: "#d1eaac" },
    { name: "Notifications", color: "#f8d2e8" },
    { name: "Other", color: DEFAULT_METHOD_COLOR },
  ];
}

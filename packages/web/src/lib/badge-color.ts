/**
 * Returns the appropriate badge variant based on MCP method name
 * Following Figma design tokens
 */
export function getMethodBadgeVariant(
  method: string,
): "info" | "success" | "warning" | "error" {
  // tools/* methods → info (purple)
  if (method.startsWith("tools/")) {
    return "info";
  }

  // resources/* methods → warning (yellow)
  if (method.startsWith("resources/")) {
    return "warning";
  }

  // notifications/* methods → warning (yellow)
  if (method.startsWith("notifications/")) {
    return "warning";
  }

  // initialize → success (green)
  if (method === "initialize") {
    return "success";
  }

  // Default → info
  return "info";
}

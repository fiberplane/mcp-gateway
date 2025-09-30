import packageJson from "../../../package.json" with { type: "json" };
import type { Registry, ServerHealth } from "../../registry.js";
import type { DeleteServerState, FormState, ModalContent } from "../state.js";
import {
  BOLD,
  CYAN,
  DIM,
  GRAY,
  GREEN,
  RED,
  RESET_COLOR,
  YELLOW,
} from "./formatting.js";

function getHealthColor(health?: ServerHealth): string {
  switch (health) {
    case "up":
      return GREEN;
    case "down":
      return RED;
    default:
      return GRAY;
  }
}

function getHealthIndicator(health?: ServerHealth): string {
  const color = getHealthColor(health);
  return `${color}●${RESET_COLOR}`;
}

export function renderModal(
  content: ModalContent,
  formState?: FormState,
  deleteServerState?: DeleteServerState,
  registry?: Registry,
): string {
  let output = "";

  if (content === "mcp_instructions") {
    output += renderMcpInstructions();
    output += "\n";
    output += `${DIM}Press any key to go back${RESET_COLOR}\n`;
  } else if (content === "add_server_form" && formState) {
    output += renderAddServerForm(formState);
  } else if (
    content === "delete_server_form" &&
    deleteServerState &&
    registry
  ) {
    output += renderDeleteServerForm(deleteServerState, registry);
  }

  return output;
}

function renderMcpInstructions(): string {
  let output = "";
  output += `${CYAN}Fiberplane MCP Gateway v${packageJson.version}${RESET_COLOR}\n`;
  output += "\n";

  output += `${GREEN}This MCP Gateway is also an MCP server.${RESET_COLOR}\n`;
  output += `${YELLOW}Endpoint:${RESET_COLOR} http://localhost:3333/mcp\n`;
  output += `${DIM}Connect it to your agent (MCP Client) and use it to manage${RESET_COLOR}\n`;
  output += `${DIM}other MCP server connections, or inspect and analyze captured traffic${RESET_COLOR}\n`;
  output += "\n";

  // Available Tools
  output += `${GREEN}Available Tools:${RESET_COLOR}\n`;
  output += `  ${CYAN}•${RESET_COLOR} add_server      - Register new MCP servers\n`;
  output += `  ${CYAN}•${RESET_COLOR} remove_server   - Remove registered servers\n`;
  output += `  ${CYAN}•${RESET_COLOR} list_servers    - List all servers\n`;
  output += `  ${CYAN}•${RESET_COLOR} search_records  - Search captured traffic\n`;
  output += `  ${CYAN}•${RESET_COLOR} analyze_session - Analyze session flows\n`;
  output += `  ${CYAN}•${RESET_COLOR} get_server_stats - Server statistics\n`;
  output += "\n";

  // Example Config
  output += `${GREEN}Example MCP Client Config (Claude Desktop):${RESET_COLOR}\n`;
  output += `${DIM}{${RESET_COLOR}\n`;
  output += `${DIM}  "mcpServers": {${RESET_COLOR}\n`;
  output += `${DIM}    "mcp-gateway": {${RESET_COLOR}\n`;
  output += `${DIM}      "url": ${RESET_COLOR}${YELLOW}"http://localhost:3333/mcp"${RESET_COLOR}\n`;
  output += `${DIM}    }${RESET_COLOR}\n`;
  output += `${DIM}  }${RESET_COLOR}\n`;
  output += `${DIM}}${RESET_COLOR}\n`;
  output += "\n";

  // Storage
  output += `${GREEN}Storage:${RESET_COLOR}\n`;
  output += `${DIM}All captured traffic is stored in: ~/.mcp-gateway${RESET_COLOR}\n`;

  return output;
}

function renderAddServerForm(formState: FormState): string {
  let output = "";
  output += `${CYAN}Add New Server${RESET_COLOR}\n`;
  output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
  output += "\n";

  // Render each field
  for (let i = 0; i < formState.fields.length; i++) {
    const field = formState.fields[i];
    if (!field) continue;

    const isFocused = i === formState.focusedFieldIndex;

    // Label with hint text on same line
    const hint = field.placeholder
      ? ` ${DIM}(${field.placeholder})${RESET_COLOR}`
      : "";
    output += `${isFocused ? BOLD : DIM}${field.label}${hint}:${RESET_COLOR}\n`;

    // Input box with value and cursor
    const displayValue = field.value;
    const cursor = isFocused ? "_" : "";
    const prefix = isFocused ? `${YELLOW}>${RESET_COLOR} ` : "  ";
    output += `${prefix}${displayValue}${cursor}\n`;

    // Error message
    if (field.error) {
      output += `${RED}  ${field.error}${RESET_COLOR}\n`;
    }

    output += "\n";
  }

  output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
  output += `${DIM}[Tab] Next • [Enter] Submit • [ESC] Cancel${RESET_COLOR}\n`;

  return output;
}

function renderDeleteServerForm(
  deleteServerState: DeleteServerState,
  registry: Registry,
): string {
  let output = "";

  if (deleteServerState.showConfirm) {
    const server = registry.servers[deleteServerState.selectedIndex];
    if (!server) return output;

    const healthIndicator = getHealthIndicator(server.health);
    const nameColor = getHealthColor(server.health);

    output += `${CYAN}Confirm Deletion${RESET_COLOR}\n`;
    output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
    output += "\n";
    output += `${YELLOW}Really remove ${healthIndicator} ${nameColor}${server.name}${RESET_COLOR}?${RESET_COLOR}\n`;
    output += `${DIM}${server.url}${RESET_COLOR}\n`;
    output += "\n";
    output += `${DIM}Note: Capture history will be preserved on disk${RESET_COLOR}\n`;
    output += "\n";
    output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
    output += `${DIM}[Enter] Confirm • [ESC] Cancel${RESET_COLOR}\n`;
  } else {
    output += `${CYAN}Remove Server${RESET_COLOR}\n`;
    output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
    output += "\n";

    if (registry.servers.length === 0) {
      output += `${DIM}No servers to remove${RESET_COLOR}\n`;
      output += "\n";
      output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
      output += `${DIM}Press any key to go back${RESET_COLOR}\n`;
      return output;
    }

    output += `${DIM}Select a server to remove:${RESET_COLOR}\n`;
    output += "\n";

    for (let i = 0; i < registry.servers.length; i++) {
      const server = registry.servers[i];
      if (!server) continue;

      const isSelected = i === deleteServerState.selectedIndex;
      const marker = isSelected ? `${YELLOW}►${RESET_COLOR}` : " ";
      const healthIndicator = getHealthIndicator(server.health);
      const nameColor = isSelected ? YELLOW : getHealthColor(server.health);

      output += `${marker} ${healthIndicator} ${nameColor}${server.name}${RESET_COLOR} ${DIM}(${server.url})${RESET_COLOR}\n`;
    }

    output += "\n";
    output += `${GRAY}${"─".repeat(60)}${RESET_COLOR}\n`;
    output += `${DIM}[↑/↓] Navigate • [Enter] Select • [ESC] Cancel${RESET_COLOR}\n`;
  }

  return output;
}

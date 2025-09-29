import { getActiveSessions, getClientInfo } from "../../capture.js";
import type { Registry } from "../../registry.js";
import type { LogEntry } from "../state.js";
import packageJson from "../../../package.json" with { type: "json" };
import {
  CLEAR_SCREEN,
  CYAN,
  DIM,
  formatRelativeTime,
  GRAY,
  GREEN,
  RED,
  RESET_COLOR,
  YELLOW,
} from "./formatting.js";

// Render the main menu
export function renderMenu(registry: Registry, logs: LogEntry[]): string {
  let output = "";

  const activeSessions = getActiveSessions();
  output += `${CYAN}Fiberplane MCP Gateway v${packageJson.version}${RESET_COLOR}\n`;
  output += `${DIM}Gateway: http://localhost:3333${RESET_COLOR}\n`;
  output += `${DIM}MCP: http://localhost:3333/mcp${RESET_COLOR}\n`;
  if (activeSessions.length > 0) {
    output += `${DIM}Active sessions: ${activeSessions.length}${RESET_COLOR}\n`;
  }
  output += "\n";

  if (registry.servers.length === 0) {
    output += `${DIM}No servers registered${RESET_COLOR}\n`;
  } else {
    output += `${CYAN}Servers:${RESET_COLOR}\n`;
    for (const server of registry.servers) {
      const activity = formatRelativeTime(server.lastActivity);
      const encodedName = encodeURIComponent(server.name);
      const proxyUrl = `http://localhost:3333/${encodedName}/mcp`;
      output += "\n";
      output += `${GREEN}${server.name}${RESET_COLOR}\n`;
      output += `${CYAN}${proxyUrl}${RESET_COLOR} ${DIM}→ ${server.url}${RESET_COLOR}\n`;
      output += `${DIM}Last active: ${activity} • ${server.exchangeCount} exchanges${RESET_COLOR}\n`;
    }
  }

  output += "\n";
  output += `${YELLOW}[a]${RESET_COLOR} Add server\n`;

  if (registry.servers.length > 0) {
    output += `${YELLOW}[d]${RESET_COLOR} Delete server\n`;
  } else {
    output += `${DIM}[d] Delete server${RESET_COLOR}\n`;
  }

  if (logs.length > 0) {
    output += `${YELLOW}[c]${RESET_COLOR} Clear activity\n`;
  } else {
    output += `${DIM}[c] Clear activity${RESET_COLOR}\n`;
  }

  output += `${YELLOW}[m]${RESET_COLOR} MCP instructions\n`;
  output += `${YELLOW}[q]${RESET_COLOR} Quit\n`;
  output += "\n";

  // Display recent logs
  if (logs.length > 0) {
    output += `${CYAN}Recent Activity:${RESET_COLOR}\n`;
    for (const log of logs) {
      // Get client info for this session
      const clientInfo = getClientInfo(log.sessionId);
      const clientLabel = clientInfo
        ? `${clientInfo.name}@${clientInfo.version}`
        : "client";

      // Session ID (first 8 chars)
      const sessionIdShort = `[${log.sessionId.slice(0, 8)}]`;

      if (log.direction === "request") {
        // Client → Gateway → Server (request flow)
        const methodDetails = formatRequestDetails(log);
        output += `${DIM}${log.timestamp.slice(11, 19)}${RESET_COLOR} ${GRAY}${sessionIdShort}${RESET_COLOR} ${CYAN}${clientLabel}${RESET_COLOR} → ${log.serverName} ${DIM}${log.method}${methodDetails}${RESET_COLOR}\n`;
      } else {
        // Server → Gateway → Client (response flow)
        const statusColor =
          log.httpStatus >= 200 && log.httpStatus < 300
            ? GREEN
            : log.httpStatus >= 400 && log.httpStatus < 500
              ? YELLOW
              : RED;

        const responseDetails = formatResponseDetails(log);
        const errorSuffix = log.errorMessage
          ? ` ${RED}${log.errorMessage}${RESET_COLOR}`
          : "";
        output += `${DIM}${log.timestamp.slice(11, 19)}${RESET_COLOR} ${GRAY}${sessionIdShort}${RESET_COLOR} ${log.serverName} → ${CYAN}${clientLabel}${RESET_COLOR} ${statusColor}(${log.httpStatus}, ${log.duration}ms)${RESET_COLOR}${responseDetails}${errorSuffix}\n`;
      }
    }
    output += "\n";
  }

  return output;
}

// Format request-specific details
function formatRequestDetails(log: LogEntry): string {
  if (!log.request?.params) return "";

  const params = log.request.params as Record<string, unknown>;

  // tools/call: show tool name and args
  if (log.method === "tools/call") {
    const toolName = params.name as string;
    const args = params.arguments as Record<string, unknown>;
    const argStr = Object.entries(args || {})
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join(", ");
    return ` ${DIM}${toolName}${argStr ? `(${argStr})` : ""}${RESET_COLOR}`;
  }

  // resources/read: show URI
  if (log.method === "resources/read") {
    const uri = params.uri as string;
    return ` ${DIM}${uri}${RESET_COLOR}`;
  }

  return "";
}

// Format response-specific details
function formatResponseDetails(log: LogEntry): string {
  if (!log.response || "error" in log.response) return "";

  const result = log.response.result as Record<string, unknown>;

  // initialize: show server name and version
  if (log.method === "initialize") {
    const serverInfo = result.serverInfo as { name: string; version: string };
    return ` ${DIM}→ ${serverInfo.name}@${serverInfo.version}${RESET_COLOR}`;
  }

  // tools/list: show count and first few tool names
  if (log.method === "tools/list") {
    const tools = result.tools as Array<{ name: string }>;
    const toolNames = tools.slice(0, 3).map((t) => t.name);
    const more = tools.length > 3 ? `, +${tools.length - 3}` : "";
    return ` ${DIM}${tools.length} tools: ${toolNames.join(", ")}${more}${RESET_COLOR}`;
  }

  // tools/call: show result text (truncated)
  if (log.method === "tools/call") {
    const content = result.content as Array<{ type: string; text?: string }>;
    const textContent = content?.find((c) => c.type === "text")?.text;
    if (textContent) {
      const truncated =
        textContent.length > 40
          ? `${textContent.slice(0, 40)}...`
          : textContent;
      return ` ${DIM}"${truncated}"${RESET_COLOR}`;
    }
  }

  // resources/list: show count
  if (log.method === "resources/list") {
    const resources = result.resources as unknown[];
    return ` ${DIM}${resources?.length || 0} resources${RESET_COLOR}`;
  }

  // prompts/list: show count
  if (log.method === "prompts/list") {
    const prompts = result.prompts as unknown[];
    return ` ${DIM}${prompts?.length || 0} prompts${RESET_COLOR}`;
  }

  return "";
}

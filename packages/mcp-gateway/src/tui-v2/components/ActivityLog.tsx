import { getClientInfo } from "../../capture";
import type { LogEntry } from "../../tui/state";
import { COLORS } from "../colors";
import { useAppStore } from "../store";

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
    return ` ${toolName}${argStr ? `(${argStr})` : ""}`;
  }

  // resources/read: show URI
  if (log.method === "resources/read") {
    const uri = params.uri as string;
    return ` ${uri}`;
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
    return ` → ${serverInfo.name}@${serverInfo.version}`;
  }

  // tools/list: show count and first few tool names
  if (log.method === "tools/list") {
    const tools = result.tools as Array<{ name: string }>;
    const toolNames = tools.slice(0, 3).map((t) => t.name);
    const more = tools.length > 3 ? `, +${tools.length - 3}` : "";
    return ` ${tools.length} tools: ${toolNames.join(", ")}${more}`;
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
      return ` "${truncated}"`;
    }
  }

  // resources/list: show count
  if (log.method === "resources/list") {
    const resources = result.resources as unknown[];
    return ` ${resources?.length || 0} resources`;
  }

  // prompts/list: show count
  if (log.method === "prompts/list") {
    const prompts = result.prompts as unknown[];
    return ` ${prompts?.length || 0} prompts`;
  }

  return "";
}

// Format a single log entry
function formatLogEntry(log: LogEntry): string {
  const clientInfo = getClientInfo(log.sessionId);
  const clientLabel = clientInfo
    ? `${clientInfo.name}@${clientInfo.version}`
    : "client";
  const sessionIdShort = `[${log.sessionId.slice(0, 8)}]`;
  const timestamp = log.timestamp.slice(11, 19);

  if (log.direction === "request") {
    // Client → Gateway → Server (request flow)
    const methodDetails = formatRequestDetails(log);
    return `${timestamp} ${sessionIdShort} ${clientLabel} → ${log.serverName} ${log.method}${methodDetails}`;
  }

  // Server → Gateway → Client (response flow)
  const responseDetails = formatResponseDetails(log);
  const errorSuffix = log.errorMessage ? ` ${log.errorMessage}` : "";
  return `${timestamp} ${sessionIdShort} ${log.serverName} → ${clientLabel} (${log.httpStatus}, ${log.duration}ms)${responseDetails}${errorSuffix}`;
}

// Get color for status code
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return COLORS.GREEN;
  if (status >= 400 && status < 500) return COLORS.YELLOW;
  return COLORS.RED;
}

export function ActivityLog() {
  const logs = useAppStore((state) => state.logs);

  if (logs.length === 0) {
    return (
      <box
        style={{ flexDirection: "column", alignItems: "center", marginTop: 2 }}
      >
        <text fg={COLORS.GRAY}>No activity</text>
      </box>
    );
    // return null; // Don't show section if no logs
  }

  // Show last 15 logs
  const recentLogs = logs.slice(-15);

  return (
    <box style={{ flexDirection: "column", marginTop: 2 }}>
      <text fg={COLORS.CYAN}>Recent Activity:</text>
      {recentLogs.map((log, i) => {
        const color =
          log.direction === "response"
            ? getStatusColor(log.httpStatus)
            : COLORS.GRAY;
        return (
          <text key={`${log.sessionId}-${i}`} fg={color}>
            {formatLogEntry(log)}
          </text>
        );
      })}
    </box>
  );
}

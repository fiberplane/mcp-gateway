import { useEffect, useState } from "react";
import { useAppStore } from "../../store";
import { useTheme } from "../../theme-context";
import { RoundedBox } from "../ui/RoundedBox";

/**
 * Debug component to see raw optimization data
 */
export function OptimizationDebug() {
  const theme = useTheme();
  const port = useAppStore((state) => state.port);
  const servers = useAppStore((state) => state.servers);
  const optimizations = useAppStore((state) => state.optimizations);

  const [rawReport, setRawReport] = useState<string>("Not loaded");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDebugInfo() {
      try {
        const { callGatewayTool } = await import("../../utils/gateway-mcp-client");
        const report = await callGatewayTool(port, "get_optimization_report", {});
        setRawReport(JSON.stringify(report, null, 2));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        setError(`${errorMsg}\n\nStack: ${errorStack || "No stack"}`);
      }
    }

    fetchDebugInfo();
  }, [port]);

  return (
    <box style={{ flexDirection: "column", padding: 1, gap: 1 }}>
      <text fg={theme.accent}>Optimization Debug Info</text>

      <RoundedBox style={{ padding: 1 }}>
        <box style={{ flexDirection: "column", gap: 0 }}>
          <text fg={theme.foreground}>Gateway Port: {port}</text>
          <text fg={theme.foreground}>Servers Count: {servers.length}</text>
          <text fg={theme.foreground}>Optimizations Map Size: {optimizations.size}</text>
        </box>
      </RoundedBox>

      <RoundedBox style={{ padding: 1 }}>
        <text fg={theme.foreground}>Servers:</text>
        {servers.map((s) => (
          <text key={s.name} fg={theme.foregroundMuted}>
            • {s.name}: {s.url}
          </text>
        ))}
      </RoundedBox>

      <RoundedBox style={{ padding: 1 }}>
        <text fg={theme.foreground}>Optimizations Map:</text>
        {Array.from(optimizations.entries()).map(([name, opt]) => (
          <box key={name} style={{ flexDirection: "column", gap: 0 }}>
            <text fg={theme.accent}>
              {name}: {opt.optimizedCount}/{opt.toolCount} tools
            </text>
            {Array.from(opt.tools.entries()).slice(0, 3).map(([toolName, tool]) => (
              <text key={toolName} fg={theme.foregroundMuted}>
                  - {toolName}: {tool.promoted ? "optimized" : "not optimized"}
              </text>
            ))}
          </box>
        ))}
      </RoundedBox>

      <RoundedBox style={{ padding: 1 }}>
        <text fg={theme.foreground}>Raw Report from Gateway:</text>
        {error ? (
          <text fg={theme.foreground}>Error: {error}</text>
        ) : (
          <text fg={theme.foregroundMuted}>{rawReport.slice(0, 500)}</text>
        )}
      </RoundedBox>
    </box>
  );
}

import { commandShortcuts, formatShortcut } from "../shortcuts";
import { useAppStore } from "../store";
import { useTheme } from "../theme-context";
import { Modal } from "./Modal";

export function McpInstructionsModal() {
  const closeModal = useAppStore((state) => state.closeModal);
  const registry = useAppStore((state) => state.registry);
  const theme = useTheme();

  const hasServers = registry.servers.length > 0;

  return (
    <Modal title="Setup Guide" onClose={closeModal} size="large" scrollable>
      <box
        style={{
          flexDirection: "column",
          gap: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        {/* Overview */}
        <Title>What is MCP Gateway?</Title>
        <text fg={theme.foreground}>
          This gateway routes MCP requests to one or more backend MCP servers,
          providing a unified endpoint for your MCP clients and allows you to
          view activity logs and introspect the gateway.
        </text>

        {/* Quick Start */}
        <Title>Quick Start</Title>

        <box>
          <text fg={theme.foreground}>
            1. Add MCP Server{hasServers ? " ✓" : ""}
          </text>
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            Press {formatShortcut(commandShortcuts.addServer.key)} to add
            backend MCP servers to the gateway
          </text>
        </box>

        <box>
          <text fg={theme.foreground}>2. Configure Your Client</text>
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            Point your MCP client to the unified gateway endpoint
          </text>
        </box>

        <box>
          <text fg={theme.foreground}>3. Start Using</text>
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            All configured servers are accessible through a single connection
          </text>
        </box>

        {/* Client Configuration */}
        <Title>Client Configuration</Title>

        {hasServers ? (
          <>
            <text fg={theme.foregroundMuted}>
              Each server is accessible at its own endpoint:
            </text>

            {/* List all servers with their URLs */}
            {registry.servers.map((server) => (
              <box
                key={server.name}
                style={{ flexDirection: "column", marginTop: 1 }}
              >
                <text fg={theme.foreground}>{server.name}:</text>
                <box
                  style={{
                    flexDirection: "column",
                    backgroundColor: theme.emphasis,
                    padding: 1,
                    marginLeft: 2,
                    borderStyle: "rounded",
                  }}
                >
                  <text fg={theme.foregroundMuted}>
                    http://localhost:3333/servers/
                    {encodeURIComponent(server.name)}/mcp
                  </text>
                </box>
              </box>
            ))}

            <text fg={theme.foreground} style={{}}>
              Claude Desktop Example ({registry.servers[0]?.name}):
            </text>
            <box
              style={{
                flexDirection: "column",
                backgroundColor: theme.emphasis,
                padding: 1,
                marginLeft: 2,
              }}
            >
              <text fg={theme.foregroundMuted}>{"{"}</text>
              <text fg={theme.foregroundMuted}>{'  "mcpServers": {'}</text>
              <text fg={theme.foregroundMuted}>
                {'    "'}
                {registry.servers[0]?.name}
                {'": {'}
              </text>
              <text fg={theme.foregroundMuted}>
                {'      "transport": "sse",'}
              </text>
              <text fg={theme.foregroundMuted}>
                {'      "url": "http://localhost:3333/servers/'}
                {encodeURIComponent(registry.servers[0]?.name || "")}
                {'/mcp"'}
              </text>
              <text fg={theme.foregroundMuted}>{"    }"}</text>
              <text fg={theme.foregroundMuted}>{"  }"}</text>
              <text fg={theme.foregroundMuted}>{"}"}</text>
            </box>
          </>
        ) : (
          <box>
            <text fg={theme.foregroundMuted}>
              <em>No examples available.</em>
            </text>
            <text fg={theme.foregroundMuted}>
              Add a server first to see configuration examples
            </text>
          </box>
        )}

        {/* Gateway's own MCP */}
        <Title>Gateway Debugging/Introspection (Optional)</Title>
        <text fg={theme.foregroundMuted}>
          The gateway also provides its own MCP server for introspection:
        </text>
        <box
          style={{
            flexDirection: "column",
            backgroundColor: theme.emphasis,
            padding: 1,
            borderStyle: "rounded",
          }}
        >
          <text fg={theme.foregroundMuted}>
            http://localhost:3333/gateway/mcp
          </text>
        </box>
        <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
          This provides tools to view activity logs and gateway information
        </text>

        {/* Troubleshooting */}
        <Title>Troubleshooting</Title>

        <text fg={theme.foreground}>No activity appearing?</text>
        <IndentedText>
          <text fg={theme.foregroundMuted}>
            • Ensure at least one server is configured (
            {formatShortcut(commandShortcuts.addServer.key)})
          </text>
          <text fg={theme.foregroundMuted}>
            • Verify your client is configured with the gateway URL
          </text>
          <text fg={theme.foregroundMuted}>
            • Check that backend servers are running and accessible
          </text>
        </IndentedText>

        <text fg={theme.foreground}>Server shows as "down"?</text>
        <IndentedText>
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            • Check the server's URL is correct
          </text>
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            • Verify the backend server is running
          </text>
          <text fg={theme.foregroundMuted} style={{ paddingLeft: 2 }}>
            • Ensure network connectivity to the backend server
          </text>
        </IndentedText>

        {/* More Info */}
        <box>
          <text fg={theme.foregroundMuted} style={{}}>
            For more information, visit:
          </text>
          <text fg={theme.accent} style={{ paddingLeft: 2 }}>
            https://github.com/fiberplane/mcp-gateway
          </text>
        </box>
      </box>
    </Modal>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <text fg={theme.accent}>
      <strong>{children}</strong>
    </text>
  );
}

function IndentedText({ children }: { children: React.ReactNode }) {
  return <box style={{ paddingLeft: 2 }}>{children}</box>;
}

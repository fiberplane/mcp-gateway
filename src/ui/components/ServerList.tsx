import type { FC } from "hono/jsx";
import type { McpServer } from "../../registry.js";

interface ServerListProps {
  servers: McpServer[];
  showTitle?: boolean;
  compact?: boolean;
}

export const ServerList: FC<ServerListProps> = ({
  servers,
  showTitle = true,
  compact = false,
}) => {
  if (servers.length === 0) {
    return (
      <div>
        {showTitle && <h2>Connected Servers</h2>}
        <p>No servers are currently registered.</p>
        <p>
          <a href="/ui/add">Add your first server</a> to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      {showTitle && <h2>Connected Servers</h2>}
      <p>
        {servers.length} server{servers.length !== 1 ? "s" : ""} registered
      </p>

      <table>
        <thead>
          <tr>
            <th class="width-min">Name</th>
            <th class="width-auto">URL</th>
            <th class="width-min">Last Seen</th>
            {!compact && <th class="width-min">Exchanges</th>}
            <th class="width-min">Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server.name}>
              <td>{server.name}</td>
              <td>{server.url}</td>
              <td>
                {server.lastActivity
                  ? new Date(server.lastActivity).toLocaleString()
                  : "Never"}
              </td>
              {!compact && <td>{server.exchangeCount}</td>}
              <td>
                <button
                  type="button"
                  onclick={`window.location.href='/ui/server/${server.name}'`}
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

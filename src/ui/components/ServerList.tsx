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
            <th class="width-min">Type</th>
            {!compact && (
              <>
                <th class="width-min">Exchanges</th>
                <th class="width-min">Last Activity</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server.name}>
              <td>{server.name}</td>
              <td>
                <a href={server.url} target="_blank" rel="noopener noreferrer">
                  {server.url}
                </a>
              </td>
              <td>{server.type}</td>
              {!compact && (
                <>
                  <td>{server.exchangeCount}</td>
                  <td>
                    {server.lastActivity
                      ? new Date(server.lastActivity).toLocaleString()
                      : "Never"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {!compact && (
        <details>
          <summary>Server Details</summary>
          <div>
            {servers.map((server) => (
              <div key={`details-${server.name}`}>
                <h3>{server.name}</h3>
                <ul>
                  <li>
                    <strong>URL:</strong> {server.url}
                  </li>
                  <li>
                    <strong>Type:</strong> {server.type}
                  </li>
                  <li>
                    <strong>Exchange Count:</strong> {server.exchangeCount}
                  </li>
                  <li>
                    <strong>Last Activity:</strong>{" "}
                    {server.lastActivity || "Never"}
                  </li>
                  <li>
                    <strong>Headers:</strong>
                    {Object.keys(server.headers).length === 0 ? (
                      " None"
                    ) : (
                      <ul>
                        {Object.entries(server.headers).map(([key, value]) => (
                          <li key={key}>
                            <code>
                              {key}: {value}
                            </code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

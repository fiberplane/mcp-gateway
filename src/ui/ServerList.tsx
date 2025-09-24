import type { FC } from "hono/jsx";
import type { McpServer } from "../registry.js";

interface ServerListProps {
  servers: McpServer[];
}

export const ServerList: FC<ServerListProps> = ({ servers }) => {
  return (
    <div>
      <h1>MCP Gateway - Connected Servers</h1>

      {servers.length === 0 ? (
        <div>
          <p>No servers are currently registered.</p>
          <p>Use the CLI or API to add servers to this gateway.</p>
        </div>
      ) : (
        <div>
          <p>
            Found {servers.length} registered server
            {servers.length !== 1 ? "s" : ""}:
          </p>

          <table>
            <thead>
              <tr>
                <th class="width-min">Name</th>
                <th class="width-auto">URL</th>
                <th class="width-min">Type</th>
                <th class="width-min">Exchanges</th>
                <th class="width-min">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.name}>
                  <td>{server.name}</td>
                  <td>
                    <a
                      href={server.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {server.url}
                    </a>
                  </td>
                  <td>{server.type}</td>
                  <td>{server.exchangeCount}</td>
                  <td>
                    {server.lastActivity
                      ? new Date(server.lastActivity).toLocaleString()
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
                          {Object.entries(server.headers).map(
                            ([key, value]) => (
                              <li key={key}>
                                <code>
                                  {key}: {value}
                                </code>
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </li>
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <hr />

      <nav>
        <a href="/ui">← Back to UI Home</a>
        <span> | </span>
        <a href="/status">JSON Status</a>
        <span> | </span>
        <a href="/">Gateway Info</a>
      </nav>
    </div>
  );
};

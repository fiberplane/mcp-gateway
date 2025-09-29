import type { FC } from "hono/jsx";
import type { Registry } from "../../registry.js";
import { Navigation } from "../components/Navigation.js";
import { ServerList } from "../components/ServerList.js";
import { Layout } from "../Layout.js";

interface HomePageProps {
  registry: Registry;
}

export const HomePage: FC<HomePageProps> = ({ registry }) => {
  return (
    <Layout>
      <h1>MCP Gateway</h1>
      <p>Manage your MCP servers through this web interface.</p>

      {registry.servers.length === 0 ? (
        <div>
          <p>Welcome! Get started by adding your first MCP server.</p>
          <p>
            <a href="/ui/add">Add Server</a> or{" "}
            <a href="/status">view API status</a>
          </p>
        </div>
      ) : (
        <div>
          <ServerList servers={registry.servers} compact={true} />
          <p>
            <a href="/ui/servers">View all servers</a> |{" "}
            <a href="/ui/add">Add new server</a>
          </p>
        </div>
      )}

      <hr />

      <Navigation currentPage="home" />
    </Layout>
  );
};

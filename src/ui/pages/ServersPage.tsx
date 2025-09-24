import type { FC } from "hono/jsx";
import type { Registry } from "../../registry.js";
import { Navigation } from "../components/Navigation.js";
import { ServerList } from "../components/ServerList.js";
import { Layout } from "../Layout.js";

interface ServersPageProps {
  registry: Registry;
}

export const ServersPage: FC<ServersPageProps> = ({ registry }) => {
  return (
    <Layout>
      <h1>All Servers</h1>
      <p>Complete list of registered MCP servers.</p>

      <ServerList servers={registry.servers} showTitle={false} />

      <hr />

      <Navigation currentPage="servers" />
    </Layout>
  );
};

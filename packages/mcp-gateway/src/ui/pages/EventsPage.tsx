import type { FC } from "hono/jsx";
import type { Registry } from "../../registry.js";
import { Navigation } from "../components/Navigation.js";
import {
  generateMockEvents,
  RecentEventsTable,
} from "../components/RecentEventsTable.js";
import { Layout } from "../Layout.js";

interface EventsPageProps {
  registry: Registry;
}

export const EventsPage: FC<EventsPageProps> = ({ registry }) => {
  const serverNames = registry.servers.map((s) => s.name);
  const mock = generateMockEvents(25, serverNames);

  return (
    <Layout>
      <h1>Recent Events</h1>
      <p>Mocked MCP JSON-RPC exchanges for quick visualization.</p>

      <nav>
        <a href="/ui/events">Refresh</a>
      </nav>

      <RecentEventsTable events={mock} />

      <hr />
      <Navigation />
    </Layout>
  );
};

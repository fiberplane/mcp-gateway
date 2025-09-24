import { Hono } from "hono";
import type { Registry } from "../registry.js";
import { Layout } from "./Layout.js";
import { ServerList } from "./ServerList.js";

export function createUIHandler(registry: Registry) {
  const uiHandler = new Hono();

  uiHandler.get("/", (c) => {
    return c.html(
      <Layout>
        <h1>MCP Gateway UI</h1>
        <p>Welcome to the MCP Gateway web interface.</p>
        <nav>
          <a href="/ui/servers">View Connected Servers</a>
          <span> | </span>
          <a href="/status">JSON API Status</a>
        </nav>
      </Layout>,
    );
  });

  uiHandler.get("/servers", (c) => {
    return c.html(
      <Layout>
        <ServerList servers={registry.servers} />
      </Layout>,
    );
  });

  return uiHandler;
}

// Legacy export for backward compatibility
export const uiHandler = createUIHandler({ servers: [] });

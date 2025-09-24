import { Hono } from "hono";
import { addServer, type Registry } from "../registry.js";
import { saveRegistry } from "../storage.js";
import { Layout } from "./Layout.js";
import { AddServerPage } from "./pages/AddServerPage.js";
import { HomePage } from "./pages/HomePage.js";
import { ServersPage } from "./pages/ServersPage.js";

export function createUIHandler(registry: Registry, storageDir: string) {
  const uiHandler = new Hono();

  uiHandler.get("/", (c) => {
    return c.html(<HomePage registry={registry} />);
  });

  uiHandler.get("/servers", (c) => {
    return c.html(<ServersPage registry={registry} />);
  });

  uiHandler.get("/add", (c) => {
    return c.html(<AddServerPage />);
  });

  uiHandler.post("/add-server", async (c) => {
    try {
      const formData = await c.req.formData();
      const name = formData.get("name")?.toString()?.trim();
      const url = formData.get("url")?.toString()?.trim();

      if (!name || !url) {
        return c.html(
          <Layout>
            <h1>Error</h1>
            <p>Both name and URL are required.</p>
            <nav>
              <a href="/ui">← Back</a>
            </nav>
          </Layout>,
          400,
        );
      }

      // Add server to registry
      const newServer = {
        name,
        url,
        type: "http" as const,
        headers: {},
      };

      const updatedRegistry = addServer(registry, newServer);

      // Update the registry object in place
      registry.servers = updatedRegistry.servers;

      // Save to disk
      await saveRegistry(storageDir, registry);

      // Redirect back to servers page with success
      return c.redirect("/ui/servers");
    } catch (error) {
      return c.html(
        <Layout>
          <h1>Error</h1>
          <p>Failed to add server: {String(error)}</p>
          <nav>
            <a href="/ui">← Back</a>
          </nav>
        </Layout>,
        500,
      );
    }
  });

  return uiHandler;
}

// Legacy export for backward compatibility
export const uiHandler = createUIHandler({ servers: [] }, "");

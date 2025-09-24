import { Hono } from "hono";
import { Layout } from "./Layout.js";

export const uiHandler = new Hono();

uiHandler.get("/", (c) => {
  return c.html(
    <Layout>
      <h1>UI</h1>
      <p>This is the UI</p>
    </Layout>,
  );
});

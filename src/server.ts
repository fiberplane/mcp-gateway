import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello, world!"))

const port = 3333;

export default {
  port,
  fetch: app.fetch,
};

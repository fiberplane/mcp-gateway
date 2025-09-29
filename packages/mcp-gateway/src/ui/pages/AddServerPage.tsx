import type { FC } from "hono/jsx";
import { AddServerForm } from "../components/AddServerForm.js";
import { Navigation } from "../components/Navigation.js";
import { Layout } from "../Layout.js";

export const AddServerPage: FC = () => {
  return (
    <Layout>
      <h1>Add New Server</h1>
      <p>Register a new MCP server to the gateway.</p>

      <AddServerForm showTitle={false} />

      <hr />

      <Navigation currentPage="add" />
    </Layout>
  );
};

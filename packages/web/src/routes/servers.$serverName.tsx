import { createFileRoute } from "@tanstack/react-router";
import { ServerDetailsPage } from "../pages/server-details-page";

export const Route = createFileRoute("/servers/$serverName")({
  component: ServerDetailsPage,
});

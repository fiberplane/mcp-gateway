import { createFileRoute } from "@tanstack/react-router";
import { MarketplacePage } from "../pages/marketplace-page";

export const Route = createFileRoute("/marketplace")({
  component: MarketplacePage,
});

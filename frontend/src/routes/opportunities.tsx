import { createFileRoute } from "@tanstack/react-router";
import { OpportunitiesContent } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
export const Route = createFileRoute("/opportunities")({
  head: () =>
    pageMetadata(
      "Explore Opportunities",
      "Explore MoonCreditFi business-financing opportunities and Mudarabah principles. Investment participation is not available yet.",
    ),
  component: OpportunitiesContent,
});

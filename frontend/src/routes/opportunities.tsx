import { createFileRoute } from "@tanstack/react-router";
import { OpportunitiesContent } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
export const Route = createFileRoute("/opportunities")({
  head: () =>
    pageMetadata(
      "Explore Opportunities",
      "Explore live MoonCreditFi Mudarabah pools and review funding progress directly from Solana Devnet.",
    ),
  component: OpportunitiesContent,
});

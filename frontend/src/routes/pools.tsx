import { createFileRoute } from "@tanstack/react-router";
import { PoolsContent } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
export const Route = createFileRoute("/pools")({
  head: () =>
    pageMetadata(
      "Mudarabah Pools",
      "Create admin-reviewed funding proposals, manage approved pools, and contribute USDC on Solana Devnet.",
    ),
  component: PoolsContent,
});

import { createFileRoute } from '@tanstack/react-router';
import { PoolsContent } from '@/components/workspace';
import { pageMetadata } from '@/lib/page-metadata';
export const Route = createFileRoute('/pools')({
  head: () => pageMetadata('Mudarabah Pools', 'MoonCreditFi Mudarabah pool workspace on Solana Devnet. On-chain financial operations are unavailable until a verified program is configured.'),
  component: PoolsContent,
});
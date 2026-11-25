import { useWallet } from "@solana/wallet-adapter-react";
import { CircleAlert, Wallet } from "lucide-react";
import { BN } from "@coral-xyz/anchor";
import { WalletConnectButton } from "@/components/wallet/wallet-connect";
import { usePools, usePositions, useProposals } from "@/lib/use-mooncredit";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";

function formatUsdc(amount: BN) {
  const whole = amount.div(new BN(1_000_000)).toString();
  const fractional = amount.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}

function statusName(status: string | Record<string, unknown>) {
  return typeof status === "string"
    ? status.toLowerCase()
    : (Object.keys(status)[0]?.toLowerCase() ?? "unknown");
}

export function DashboardMetrics({ entrepreneur }: { entrepreneur: boolean }) {
  const { publicKey } = useWallet();
  const poolsQuery = usePools();
  const positionsQuery = usePositions(publicKey);
  const proposalsQuery = useProposals();
  const pools = poolsQuery.data ?? [];
  const positions = positionsQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const loading = poolsQuery.isLoading || positionsQuery.isLoading || proposalsQuery.isLoading;
  const error = poolsQuery.error ?? positionsQuery.error ?? proposalsQuery.error;

  if (!publicKey) {
    return (
      <div className="workspace-empty workspace-metrics-empty">
        <Wallet aria-hidden="true" />
        <h2>Connect your Solana wallet</h2>
        <p>
          Live {entrepreneur ? "proposal" : "portfolio"} metrics are read from {SOLANA_NETWORK}.
        </p>
        <WalletConnectButton />
      </div>
    );
  }

  if (loading) return <p aria-live="polite">Loading verified on-chain activity…</p>;
  if (error) {
    return (
      <div className="workspace-empty" role="alert">
        <CircleAlert aria-hidden="true" />
        <h2>Live activity could not be loaded</h2>
        <p>
          {error instanceof Error ? error.message : "Check the Solana connection and try again."}
        </p>
      </div>
    );
  }

  if (entrepreneur) {
    const proposalKeys = new Set(proposals.map(({ publicKey: key }) => key.toBase58()));
    const ownPools = pools.filter(({ account }) => proposalKeys.has(account.proposal.toBase58()));
    const activePools = ownPools.filter(({ account }) => statusName(account.status) === "open");
    const investorCount = ownPools.reduce((total, { account }) => total + account.investorCount, 0);
    const approved = proposals.filter(({ account }) => account.approved).length;
    const items = [
      { label: "Your proposals", value: String(proposals.length), detail: "On-chain records" },
      { label: "Approved", value: String(approved), detail: "Platform authority" },
      {
        label: "Active pools",
        value: String(activePools.length),
        detail: "Accepting contributions",
      },
      { label: "Investor positions", value: String(investorCount), detail: "Across your pools" },
    ];
    return (
      <>
        {items.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </>
    );
  }

  const invested = positions.reduce(
    (total, position) => total.add(position.account.contributed),
    new BN(0),
  );
  const poolByKey = new Map(pools.map((pool) => [pool.publicKey.toBase58(), pool]));
  const activePositions = positions.filter((position) => {
    const pool = poolByKey.get(position.account.pool.toBase58());
    return pool && statusName(pool.account.status) === "open";
  }).length;
  const openPools = pools.filter(({ account }) => statusName(account.status) === "open").length;
  const items = [
    { label: "Contributed", value: `${formatUsdc(invested)} USDC`, detail: "Confirmed positions" },
    { label: "Active positions", value: String(activePositions), detail: "In open pools" },
    { label: "Total positions", value: String(positions.length), detail: "Recorded on-chain" },
    { label: "Open pools", value: String(openPools), detail: "Available on Devnet" },
  ];
  return (
    <>
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </>
  );
}

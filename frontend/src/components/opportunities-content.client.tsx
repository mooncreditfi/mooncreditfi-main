import { useMemo, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { Search, SlidersHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { usePools, usePublicProposals } from "@/lib/use-mooncredit";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";

function formatUsdc(amount: BN) {
  const whole = amount.div(new BN(1_000_000)).toString();
  const fractional = amount.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}
function statusName(status: string | Record<string, unknown>) {
  return typeof status === "string" ? status : (Object.keys(status)[0] ?? "Unknown");
}
function shortKey(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function OpportunitiesContentClient() {
  const poolsQuery = usePools();
  const proposalsQuery = usePublicProposals();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const pools = useMemo(() => poolsQuery.data ?? [], [poolsQuery.data]);
  const proposals = useMemo(() => proposalsQuery.data ?? [], [proposalsQuery.data]);
  const proposalByKey = useMemo(
    () => new Map(proposals.map((proposal) => [proposal.publicKey.toBase58(), proposal])),
    [proposals],
  );
  const loadError = poolsQuery.error ?? proposalsQuery.error;
  const loading = poolsQuery.isLoading || proposalsQuery.isLoading;
  const filteredPools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pools
      .filter(({ account, publicKey }) => {
        const status = statusName(account.status).toLowerCase();
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "open" ? status === "open" : status !== "open");
        const matchesQuery =
          !query ||
          `${publicKey.toBase58()} ${account.proposal.toBase58()}`.toLowerCase().includes(query);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        const aGoal = a.account.fundingGoal;
        const bGoal = b.account.fundingGoal;
        const aProgress = aGoal.isZero()
          ? 0
          : a.account.totalContributed.mul(new BN(10_000)).div(aGoal).toNumber();
        const bProgress = bGoal.isZero()
          ? 0
          : b.account.totalContributed.mul(new BN(10_000)).div(bGoal).toNumber();
        return bProgress - aProgress;
      });
  }, [pools, search, statusFilter]);

  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="INVESTOR WORKSPACE"
        title="Funding opportunities"
        description="Explore live pools and review on-chain funding progress before participating."
      />
      <div className="workspace-section-heading">
        <h2>Pool discovery</h2>
        <span>
          {pools.length} on-chain {pools.length === 1 ? "pool" : "pools"} · {SOLANA_NETWORK}
        </span>
      </div>
      <div className="opportunity-filters" role="search" aria-label="Filter live pools">
        <label className="opportunity-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search pool or proposal address</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pool or proposal address"
          />
        </label>
        <label className="opportunity-status">
          <SlidersHorizontal aria-hidden="true" />
          <span className="sr-only">Pool status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open for funding</option>
            <option value="closed">Not open</option>
          </select>
        </label>
      </div>
      {loading && <p aria-live="polite">Loading live pools from Solana…</p>}
      {loadError && (
        <div className="workspace-empty" role="alert">
          <h2>Could not load opportunities</h2>
          <p>
            {loadError instanceof Error
              ? loadError.message
              : "The Solana connection is unavailable."}
          </p>
          <Button
            variant="quiet"
            onClick={() => void Promise.all([poolsQuery.refetch(), proposalsQuery.refetch()])}
          >
            Retry
          </Button>
        </div>
      )}
      {!loading && !loadError && filteredPools.length === 0 && (
        <div className="workspace-empty">
          <h2>{pools.length ? "No matching pools" : "No live pools yet"}</h2>
          <p>
            {pools.length
              ? "Try a different address or status filter."
              : "Approved proposals become discoverable here after an entrepreneur creates a pool. No business descriptions are available from the current on-chain account schema."}
          </p>
          {pools.length > 0 && (
            <Button
              variant="quiet"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
      {filteredPools.length > 0 && (
        <section className="opportunity-grid" aria-label="Live funding pools">
          {filteredPools.map(({ publicKey, account }) => {
            const goal = account.fundingGoal;
            const raised = account.totalContributed;
            const progress = goal.isZero()
              ? 0
              : Math.min(100, raised.mul(new BN(10_000)).div(goal).toNumber() / 100);
            const status = statusName(account.status);
            const proposal = proposalByKey.get(account.proposal.toBase58());
            const entrepreneurShare = proposal
              ? `${(proposal.account.entrepreneurProfitBps / 100).toFixed(2).replace(/\.?0+$/, "")}%`
              : "Unavailable";
            return (
              <article className="opportunity-card" key={publicKey.toBase58()}>
                <div className="opportunity-card-top">
                  <span className="eyebrow">LIVE SOLANA POOL</span>
                  <span
                    className={`opportunity-status-badge ${status.toLowerCase() === "open" ? "is-open" : ""}`}
                  >
                    {status}
                  </span>
                </div>
                <h3>Pool {shortKey(publicKey.toBase58())}</h3>
                <p className="opportunity-address">
                  Proposal {shortKey(account.proposal.toBase58())}
                </p>
                <div className="opportunity-funding">
                  <span>Raised</span>
                  <strong>
                    {formatUsdc(raised)} <small>USDC</small>
                  </strong>
                </div>
                <div className="opportunity-progress-label">
                  <span>Funding progress</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div
                  className="opportunity-progress"
                  role="progressbar"
                  aria-label={`Funding progress for pool ${shortKey(publicKey.toBase58())}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="opportunity-card-foot">
                  <span>Target: {formatUsdc(goal)} USDC</span>
                  <span>
                    {account.investorCount} {account.investorCount === 1 ? "position" : "positions"}
                  </span>
                </div>
                <p className="opportunity-address">
                  Entrepreneur {shortKey(account.entrepreneur.toBase58())}
                </p>
                <p className="opportunity-address">
                  Entrepreneur profit share: {entrepreneurShare}
                </p>
                <p className="opportunity-disclosure">
                  The deployed program does not store business descriptions or supporting documents.
                  Review the on-chain funding target and entrepreneur profit-share term
                  independently before contributing.
                </p>
                <Button asChild variant={status.toLowerCase() === "open" ? "gold" : "quiet"}>
                  <Link to="/pools">
                    {status.toLowerCase() === "open"
                      ? "Review and contribute"
                      : "View pool activity"}
                  </Link>
                </Button>
              </article>
            );
          })}
        </section>
      )}
    </Workspace>
  );
}

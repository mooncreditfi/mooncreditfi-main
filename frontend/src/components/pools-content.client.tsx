import { BN } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Handshake,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";
import {
  CONFIG_SEED,
  ENTREPRENEUR_SEED,
  getMoonCreditProgramReadiness,
  moonCreditProgramId,
  moonCreditUsdcMint,
  POOL_SEED,
  POSITION_SEED,
  PROPOSAL_SEED,
  REJECTION_SEED,
  SETTLEMENT_SEED,
  VAULT_SEED,
} from "@/lib/mooncredit-program";
import {
  parseUsdcAmount,
  parseUsdcAmountAllowZero,
  validateContributionAmount,
} from "@/lib/pool-utils";
import { calculateEntrepreneurProfit, calculateInvestorPayout } from "@/lib/payouts";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";
import {
  moonCreditQueryKeys,
  useConfig,
  usePools,
  usePositions,
  useProgram,
  useProposals,
  usePublicProposals,
  useProposalRejections,
} from "@/lib/use-mooncredit";
import { txToast } from "@/lib/tx-toast";

type PoolProposal = NonNullable<ReturnType<typeof useProposals>["data"]>[number];
type LivePool = NonNullable<ReturnType<typeof usePools>["data"]>[number];
type LivePosition = NonNullable<ReturnType<typeof usePositions>["data"]>[number];

function formatUsdc(amount: BN): string {
  const whole = amount.div(new BN(1_000_000)).toString();
  const fractional = amount.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}

function formatProfitShare(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function shortKey(key: PublicKey): string {
  const value = key.toBase58();
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

function statusName(status: LivePool["account"]["status"]): string {
  if (typeof status === "string") return status;
  return Object.keys(status)[0] ?? "unknown";
}

function displayStatus(status: LivePool["account"]["status"]): string {
  return statusName(status)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Please try again.";
}

function expectedInvestorPayout(pool: LivePool, position: LivePosition): BN | null {
  const status = statusName(pool.account.status).toLowerCase();
  if (status === "cancelled") return position.account.contributed;
  if (status !== "settled") return null;
  return calculateInvestorPayout(
    position.account.contributed,
    pool.account.totalContributed,
    pool.account.totalReturned,
    10_000 - pool.account.entrepreneurProfitBps,
  );
}

export function PoolsContentClient() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const program = useProgram();
  const queryClient = useQueryClient();
  const poolsQuery = usePools();
  const positionsQuery = usePositions(publicKey);
  const proposalsQuery = useProposals();
  const publicProposalsQuery = usePublicProposals();
  const rejectionsQuery = useProposalRejections();
  const configQuery = useConfig();
  const pools = useMemo(() => poolsQuery.data ?? [], [poolsQuery.data]);
  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const positionByPool = useMemo(
    () => new Map(positions.map((position) => [position.account.pool.toBase58(), position])),
    [positions],
  );
  const proposals = proposalsQuery.data ?? [];
  const publicProposals = useMemo(
    () => publicProposalsQuery.data ?? [],
    [publicProposalsQuery.data],
  );
  const publicProposalByKey = useMemo(
    () => new Map(publicProposals.map((proposal) => [proposal.publicKey.toBase58(), proposal])),
    [publicProposals],
  );
  const rejectedProposalKeys = useMemo(
    () => new Set((rejectionsQuery.data ?? []).map(({ account }) => account.proposal.toBase58())),
    [rejectionsQuery.data],
  );
  const loadError =
    poolsQuery.error ??
    positionsQuery.error ??
    proposalsQuery.error ??
    publicProposalsQuery.error ??
    rejectionsQuery.error ??
    configQuery.error;
  const error = loadError ? errorMessage(loadError) : "";
  const loading =
    poolsQuery.isFetching ||
    positionsQuery.isFetching ||
    proposalsQuery.isFetching ||
    publicProposalsQuery.isFetching ||
    rejectionsQuery.isFetching ||
    configQuery.isFetching;
  const [busy, setBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [recentSignature, setRecentSignature] = useState("");
  const [entrepreneurRole, setEntrepreneurRole] = useState(false);
  const [fundingGoal, setFundingGoal] = useState("");
  const [entrepreneurProfitBps, setEntrepreneurProfitBps] = useState("2000");
  const [termDays, setTermDays] = useState("90");
  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});
  const [poolSearch, setPoolSearch] = useState("");
  const [poolStatusFilter, setPoolStatusFilter] = useState("all");

  async function refresh() {
    await Promise.all([
      poolsQuery.refetch(),
      proposalsQuery.refetch(),
      publicProposalsQuery.refetch(),
      rejectionsQuery.refetch(),
      configQuery.refetch(),
    ]);
  }

  useEffect(() => {
    let active = true;
    const updateRole = (user: Parameters<typeof getMoonCreditProfile>[0]) => {
      if (active)
        setEntrepreneurRole(getMoonCreditProfile(user)?.roles.includes("entrepreneur") ?? false);
    };
    void supabase.auth
      .getUser()
      .then(({ data, error: authError }) => {
        if (authError) throw authError;
        updateRole(data.user);
      })
      .catch((authError: unknown) => {
        if (active) setProfileError(errorMessage(authError));
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateRole(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publicKey || !anchorWallet) {
      toast.error("Connect a Solana wallet to submit a proposal.");
      return;
    }
    if (!entrepreneurRole) {
      toast.error("Select the entrepreneur role in your profile before submitting a proposal.");
      return;
    }
    let goal: BN;
    const share = Number(entrepreneurProfitBps);
    const businessTermDays = Number(termDays);
    try {
      goal = parseUsdcAmount(fundingGoal);
    } catch (amountError) {
      toast.error(errorMessage(amountError));
      return;
    }
    if (!Number.isInteger(share) || share < 0 || share > 10_000) {
      toast.error("Profit share must be between 0 and 10,000 basis points.");
      return;
    }
    if (!Number.isInteger(businessTermDays) || businessTermDays < 30 || businessTermDays > 365) {
      toast.error("Business term must be between 30 and 365 days.");
      return;
    }

    setBusy(true);
    try {
      const entrepreneurProfile = PublicKey.findProgramAddressSync(
        [ENTREPRENEUR_SEED, publicKey.toBuffer()],
        moonCreditProgramId,
      )[0];
      const existingProfile =
        await program.account.entrepreneurProfile.fetchNullable(entrepreneurProfile);
      const transaction = new Transaction();
      if (!existingProfile) {
        transaction.add(
          await program.methods
            .registerEntrepreneur()
            .accounts({
              entrepreneurProfile,
              entrepreneur: publicKey,
              systemProgram: SystemProgram.programId,
            })
            .instruction(),
        );
      }

      const businessId = Array.from(window.crypto.getRandomValues(new Uint8Array(32)));
      const proposalAddress = PublicKey.findProgramAddressSync(
        [PROPOSAL_SEED, publicKey.toBuffer(), Uint8Array.from(businessId)],
        moonCreditProgramId,
      )[0];
      transaction.add(
        await program.methods
          .createProposal(businessId, goal, share, new BN(businessTermDays * 24 * 60 * 60))
          .accounts({
            entrepreneurProfile,
            proposal: proposalAddress,
            entrepreneur: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
      const signature = await program.provider.sendAndConfirm?.(transaction);
      if (!signature) throw new Error("The Anchor provider cannot submit this transaction.");
      setRecentSignature(signature);
      txToast(
        signature,
        `Proposal submitted: ${shortKey(proposalAddress)}. It requires admin approval.`,
      );
      setFundingGoal("");
      await queryClient.invalidateQueries({ queryKey: moonCreditQueryKeys.all });
    } catch (submitError) {
      toast.error(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function createPool(proposal: PoolProposal) {
    if (!publicKey || !anchorWallet) {
      toast.error("Connect and sign in with a wallet before creating a pool.");
      return;
    }
    if (!proposal.account.approved) {
      toast.error("A platform admin must approve this proposal before a pool can be created.");
      return;
    }
    if (proposal.account.termSeconds === null) {
      toast.error(
        "This legacy proposal has no recorded business term. Submit a new proposal to create a pool.",
      );
      return;
    }
    setBusy(true);
    try {
      const poolAddress = PublicKey.findProgramAddressSync(
        [POOL_SEED, proposal.publicKey.toBuffer()],
        moonCreditProgramId,
      )[0];
      const vaultAddress = PublicKey.findProgramAddressSync(
        [VAULT_SEED, poolAddress.toBuffer()],
        moonCreditProgramId,
      )[0];
      const signature = await program.methods
        .createPool()
        .accounts({
          config: PublicKey.findProgramAddressSync([CONFIG_SEED], moonCreditProgramId)[0],
          proposal: proposal.publicKey,
          rejection: PublicKey.findProgramAddressSync(
            [REJECTION_SEED, proposal.publicKey.toBuffer()],
            moonCreditProgramId,
          )[0],
          pool: poolAddress,
          vault: vaultAddress,
          usdcMint: moonCreditUsdcMint,
          entrepreneur: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      setRecentSignature(signature);
      txToast(signature, `Pool created: ${shortKey(poolAddress)}.`);
      await queryClient.invalidateQueries({ queryKey: moonCreditQueryKeys.all });
    } catch (createError) {
      toast.error(errorMessage(createError));
    } finally {
      setBusy(false);
    }
  }

  async function contribute(pool: LivePool) {
    if (!publicKey || !anchorWallet) {
      toast.error("Connect a Solana wallet to contribute.");
      return;
    }
    const input = contributionAmounts[pool.publicKey.toBase58()] ?? "";
    let amount: BN;
    try {
      amount = parseUsdcAmount(input);
    } catch (amountError) {
      toast.error(errorMessage(amountError));
      return;
    }
    const remaining = pool.account.fundingGoal.sub(pool.account.totalContributed);
    const contributionError = validateContributionAmount(
      amount,
      remaining,
      statusName(pool.account.status).toLowerCase() === "open",
    );
    if (contributionError) {
      toast.error(contributionError);
      return;
    }

    setBusy(true);
    try {
      const investorTokenAccount = getAssociatedTokenAddressSync(moonCreditUsdcMint, publicKey);
      const position = PublicKey.findProgramAddressSync(
        [POSITION_SEED, pool.publicKey.toBuffer(), publicKey.toBuffer()],
        moonCreditProgramId,
      )[0];
      const transaction = new Transaction();
      const tokenAccountInfo = await connection.getAccountInfo(investorTokenAccount, "confirmed");
      if (!tokenAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            investorTokenAccount,
            publicKey,
            moonCreditUsdcMint,
          ),
        );
      }
      const instruction = await program.methods
        .contribute(amount)
        .accounts({
          pool: pool.publicKey,
          position,
          investorTokenAccount,
          vault: pool.account.vault,
          usdcMint: moonCreditUsdcMint,
          investor: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      transaction.add(instruction);
      const signature = await program.provider.sendAndConfirm?.(transaction);
      if (!signature) throw new Error("The Anchor provider cannot submit this transaction.");
      setRecentSignature(signature);
      txToast(signature, `USDC contribution confirmed: ${shortKey(pool.publicKey)}.`);
      setContributionAmounts((current) => ({ ...current, [pool.publicKey.toBase58()]: "" }));
      await queryClient.invalidateQueries({ queryKey: moonCreditQueryKeys.all });
    } catch (contributeError) {
      toast.error(errorMessage(contributeError));
    } finally {
      setBusy(false);
    }
  }

  async function activatePool(pool: LivePool) {
    if (!publicKey || !pool.account.entrepreneur.equals(publicKey)) {
      toast.error("Only this pool's entrepreneur can activate it.");
      return;
    }
    if (
      statusName(pool.account.status).toLowerCase() !== "open" ||
      !pool.account.totalContributed.eq(pool.account.fundingGoal)
    ) {
      toast.error("The pool must be open and fully funded before activation.");
      return;
    }

    await sendPoolTransaction(`Pool ${shortKey(pool.publicKey)} activated.`, () =>
      program.methods
        .activatePool()
        .accounts({ pool: pool.publicKey, entrepreneur: publicKey })
        .instruction(),
    );
  }

  async function disburseCapital(pool: LivePool) {
    if (!publicKey || !anchorWallet || !pool.account.entrepreneur.equals(publicKey)) {
      toast.error("Only this pool's connected entrepreneur can disburse capital.");
      return;
    }
    if (!configQuery.data?.authority.equals(publicKey)) {
      toast.error(
        "The current program requires both the entrepreneur and platform authority signatures to disburse capital.",
      );
      return;
    }
    if (statusName(pool.account.status).toLowerCase() !== "funded") {
      toast.error("Only funded pools can disburse capital.");
      return;
    }

    const entrepreneurTokenAccount = getAssociatedTokenAddressSync(moonCreditUsdcMint, publicKey);
    await sendPoolTransaction(
      `${formatUsdc(pool.account.totalContributed)} USDC disbursed for pool ${shortKey(pool.publicKey)}.`,
      () =>
        program.methods
          .disburseCapital()
          .accounts({
            config: PublicKey.findProgramAddressSync([CONFIG_SEED], moonCreditProgramId)[0],
            pool: pool.publicKey,
            vault: pool.account.vault,
            usdcMint: moonCreditUsdcMint,
            entrepreneurTokenAccount,
            authority: publicKey,
            entrepreneur: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      publicKey,
    );
  }

  async function submitSettlement(pool: LivePool) {
    if (!publicKey || !pool.account.entrepreneur.equals(publicKey)) {
      toast.error("Only this pool's entrepreneur can submit a settlement.");
      return;
    }
    if (statusName(pool.account.status).toLowerCase() !== "active") {
      toast.error("Only active pools can submit a settlement.");
      return;
    }

    const key = pool.publicKey.toBase58();
    let returnedAmount: BN;
    try {
      returnedAmount = parseUsdcAmountAllowZero(settlementAmounts[key] ?? "");
    } catch (amountError) {
      toast.error(errorMessage(amountError));
      return;
    }
    const entrepreneurTokenAccount = getAssociatedTokenAddressSync(moonCreditUsdcMint, publicKey);
    const settlement = PublicKey.findProgramAddressSync(
      [SETTLEMENT_SEED, pool.publicKey.toBuffer()],
      moonCreditProgramId,
    )[0];
    const signature = await sendPoolTransaction(
      `Settlement submitted for pool ${shortKey(pool.publicKey)}.`,
      () =>
        program.methods
          .submitSettlement(returnedAmount)
          .accounts({
            pool: pool.publicKey,
            settlement,
            vault: pool.account.vault,
            usdcMint: moonCreditUsdcMint,
            entrepreneurTokenAccount,
            entrepreneur: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      publicKey,
    );
    if (signature) {
      setSettlementAmounts((current) => ({ ...current, [key]: "" }));
    }
  }

  async function claimRefund(pool: LivePool, position: LivePosition) {
    if (
      !publicKey ||
      !position.account.investor.equals(publicKey) ||
      position.account.claimed ||
      statusName(pool.account.status).toLowerCase() !== "cancelled"
    ) {
      toast.error(
        "A refund is available only to an unclaimed investor position in a cancelled pool.",
      );
      return;
    }
    const investorTokenAccount = getAssociatedTokenAddressSync(moonCreditUsdcMint, publicKey);
    await sendPoolTransaction(
      `Refund claimed for pool ${shortKey(pool.publicKey)}.`,
      () =>
        program.methods
          .claimRefund()
          .accounts({
            pool: pool.publicKey,
            position: position.publicKey,
            vault: pool.account.vault,
            usdcMint: moonCreditUsdcMint,
            investorTokenAccount,
            investor: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      publicKey,
    );
  }

  async function claimDistribution(pool: LivePool, position: LivePosition) {
    if (
      !publicKey ||
      !position.account.investor.equals(publicKey) ||
      position.account.claimed ||
      statusName(pool.account.status).toLowerCase() !== "settled"
    ) {
      toast.error("A distribution is available only to an unclaimed position in a settled pool.");
      return;
    }
    const investorTokenAccount = getAssociatedTokenAddressSync(moonCreditUsdcMint, publicKey);
    await sendPoolTransaction(
      `Distribution claimed for pool ${shortKey(pool.publicKey)}.`,
      () =>
        program.methods
          .claimDistribution()
          .accounts({
            pool: pool.publicKey,
            position: position.publicKey,
            vault: pool.account.vault,
            usdcMint: moonCreditUsdcMint,
            investorTokenAccount,
            investor: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      publicKey,
    );
  }

  async function claimEntrepreneurProfit(pool: LivePool) {
    if (
      !publicKey ||
      !pool.account.entrepreneur.equals(publicKey) ||
      statusName(pool.account.status).toLowerCase() !== "settled" ||
      pool.account.entrepreneurClaimed ||
      pool.account.claimCount !== pool.account.investorCount
    ) {
      toast.error("Entrepreneur profit is available after all investor claims are completed.");
      return;
    }
    const entrepreneurTokenAccount = getAssociatedTokenAddressSync(moonCreditUsdcMint, publicKey);
    await sendPoolTransaction(
      `Entrepreneur profit claimed for pool ${shortKey(pool.publicKey)}.`,
      () =>
        program.methods
          .claimEntrepreneurProfit()
          .accounts({
            pool: pool.publicKey,
            vault: pool.account.vault,
            usdcMint: moonCreditUsdcMint,
            entrepreneurTokenAccount,
            entrepreneur: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      publicKey,
    );
  }

  const poolByProposal = useMemo(
    () => new Set(pools.map((pool) => pool.account.proposal.toBase58())),
    [pools],
  );
  const visiblePools = useMemo(() => {
    const query = poolSearch.trim().toLowerCase();
    return pools.filter(({ publicKey, account }) => {
      const status = statusName(account.status).toLowerCase();
      const matchesStatus =
        poolStatusFilter === "all" ||
        (poolStatusFilter === "open" ? status === "open" : status !== "open");
      const matchesSearch =
        !query ||
        `${publicKey.toBase58()} ${account.proposal.toBase58()}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [poolSearch, poolStatusFilter, pools]);
  const ownProposals = proposals;
  const readiness = getMoonCreditProgramReadiness();
  const profitShareBps = Number(entrepreneurProfitBps);
  const validProfitShare =
    Number.isInteger(profitShareBps) && profitShareBps >= 0 && profitShareBps <= 10_000;
  const profitSharePreview = validProfitShare ? formatProfitShare(profitShareBps) : "—";
  const openPoolCount = pools.filter(
    (pool) => statusName(pool.account.status).toLowerCase() === "open",
  ).length;
  const totalRaised = pools.reduce(
    (total, pool) => total.add(pool.account.totalContributed),
    new BN(0),
  );
  const totalTarget = pools.reduce((total, pool) => total.add(pool.account.fundingGoal), new BN(0));

  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="PROFIT SHARING"
        title="Mudarabah pools"
        description="Live proposals and funding totals read from the MoonCreditFi program on Solana Devnet."
      >
        <Button
          type="button"
          variant="quiet"
          onClick={() => void refresh()}
          disabled={loading || busy}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </WorkspaceTitle>

      <section className="pool-overview" aria-label="Pool overview">
        <div className="pool-overview-heading">
          <div>
            <p className="eyebrow">LIVE ON-CHAIN ACTIVITY</p>
            <h2>Funding at a glance</h2>
            <p>Pool balances are read directly from the MoonCreditFi program.</p>
          </div>
          <span className="pool-network-chip">Solana {SOLANA_NETWORK} · USDC</span>
        </div>
        <div className="pool-summary-grid">
          <article className="pool-summary-card">
            <span>Live pools</span>
            <strong>{pools.length}</strong>
            <small>{openPoolCount} open for contributions</small>
          </article>
          <article className="pool-summary-card">
            <span>Total raised</span>
            <strong>{formatUsdc(totalRaised)}</strong>
            <small>USDC across all pools</small>
          </article>
          <article className="pool-summary-card">
            <span>Funding targets</span>
            <strong>{formatUsdc(totalTarget)}</strong>
            <small>USDC requested on-chain</small>
          </article>
        </div>
        <div className="pool-program-line">
          <span>Verified program</span>
          <a
            href={`https://explorer.solana.com/address/${moonCreditProgramId.toBase58()}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            {shortKey(moonCreditProgramId)} <ExternalLink aria-hidden="true" />
          </a>
          <span className="pool-program-divider" aria-hidden="true" />
          <span>USDC mint</span>
          <code>{shortKey(moonCreditUsdcMint)}</code>
        </div>
      </section>

      {!readiness.ready && <p className="risk-note">{readiness.reason}</p>}
      <p className="risk-note">
        <CircleAlert />
        No on-chain funding or settlement deadlines or default/refund flow are implemented.
      </p>
      {recentSignature && (
        <p className="risk-note">
          Latest transaction:{" "}
          <a
            href={`https://explorer.solana.com/tx/${recentSignature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            View on Solana Explorer
          </a>
        </p>
      )}
      {error && (
        <div className="workspace-empty" role="alert">
          <h2>Could not load live pool data</h2>
          <p>{error}</p>
          <Button type="button" variant="quiet" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}
      {!error && loading && <p aria-live="polite">Loading on-chain records…</p>}
      {!error && !loading && pools.length === 0 && (
        <div className="workspace-empty">
          <div className="icon-tile">
            <Handshake />
          </div>
          <h2>No live pools yet</h2>
          <p>
            Approved proposals become open pools here. Contributions require wallet approval for
            each transaction.
          </p>
        </div>
      )}
      {!error && pools.length > 0 && (
        <div
          className="opportunity-filters pool-filter-bar"
          role="search"
          aria-label="Filter live pools"
        >
          <label className="opportunity-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search pool or proposal address</span>
            <Input
              value={poolSearch}
              onChange={(event) => setPoolSearch(event.target.value)}
              placeholder="Search pool or proposal address"
            />
          </label>
          <label className="opportunity-status">
            <span className="sr-only">Pool status</span>
            <select
              value={poolStatusFilter}
              onChange={(event) => setPoolStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="open">Open for funding</option>
              <option value="closed">Not open</option>
            </select>
          </label>
        </div>
      )}
      {!error && pools.length > 0 && visiblePools.length === 0 && (
        <div className="workspace-empty">
          <h2>No matching pools</h2>
          <p>Try another address or status filter.</p>
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              setPoolSearch("");
              setPoolStatusFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {!error && visiblePools.length > 0 && (
        <section className="pool-grid" aria-label="Live pools">
          {visiblePools.map((pool) => {
            const target = pool.account.fundingGoal;
            const raised = pool.account.totalContributed;
            const remaining = target.sub(raised);
            const status = statusName(pool.account.status);
            const open = status.toLowerCase() === "open" && remaining.gt(new BN(0));
            const progress = target.isZero()
              ? 0
              : Math.min(100, raised.mul(new BN(10_000)).div(target).toNumber() / 100);
            const proposal = publicProposalByKey.get(pool.account.proposal.toBase58());
            const profitShare = proposal
              ? formatProfitShare(proposal.account.entrepreneurProfitBps)
              : "Unavailable";
            const poolKey = pool.publicKey.toBase58();
            const position = positionByPool.get(poolKey);
            const isEntrepreneur = Boolean(
              publicKey && pool.account.entrepreneur.equals(publicKey),
            );
            const canDisburse = Boolean(
              isEntrepreneur && publicKey && configQuery.data?.authority.equals(publicKey),
            );
            const progressBasisPoints = target.isZero()
              ? 0
              : Math.min(10_000, raised.mul(new BN(10_000)).div(target).toNumber());
            const expectedPayout =
              position && (status === "settled" || status === "cancelled")
                ? expectedInvestorPayout(pool, position)
                : null;
            return (
              <article className="pool-card" key={poolKey}>
                <div className="opportunity-card-top">
                  <span className="eyebrow">LIVE ON-CHAIN POOL</span>
                  <span className={`opportunity-status-badge ${open ? "is-open" : ""}`}>
                    {status}
                  </span>
                </div>
                <h2>Pool {shortKey(pool.publicKey)}</h2>
                <p>
                  Proposal {shortKey(pool.account.proposal)} · Entrepreneur{" "}
                  {shortKey(pool.account.entrepreneur)}
                </p>
                <p>Entrepreneur profit share: {profitShare}</p>
                <div className="workspace-metrics">
                  <article>
                    <span>Funding target</span>
                    <strong>{formatUsdc(target)}</strong>
                    <small>USDC</small>
                  </article>
                  <article>
                    <span>Raised</span>
                    <strong>{formatUsdc(raised)}</strong>
                    <small>USDC</small>
                  </article>
                  <article>
                    <span>Remaining</span>
                    <strong>{formatUsdc(remaining)}</strong>
                    <small>USDC</small>
                  </article>
                  <article>
                    <span>Contributors</span>
                    <strong>{pool.account.investorCount}</strong>
                    <small>on-chain</small>
                  </article>
                </div>
                <div className="opportunity-progress-label">
                  <span>Funding progress</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div
                  className="opportunity-progress"
                  role="progressbar"
                  aria-label={`Funding progress for pool ${shortKey(pool.publicKey)}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <label className="block space-y-2">
                  <span>Contribution amount (USDC)</span>
                  <Input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    max={formatUsdc(remaining)}
                    value={contributionAmounts[poolKey] ?? ""}
                    onChange={(event) =>
                      setContributionAmounts((current) => ({
                        ...current,
                        [poolKey]: event.target.value,
                      }))
                    }
                    disabled={!open || busy}
                  />
                </label>
                {publicKey && anchorWallet ? (
                  <Button
                    type="button"
                    variant="gold"
                    disabled={!open || busy}
                    onClick={() => void contribute(pool)}
                  >
                    {busy && open ? "Contributing…" : "Contribute USDC"}
                  </Button>
                ) : (
                  <p className="wallet-action-hint">
                    Connect and sign in from the page header to contribute.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}

      <section className="positions-section" aria-labelledby="positions-title">
        <div className="positions-heading">
          <div>
            <p className="proposal-eyebrow">INVESTOR PORTFOLIO</p>
            <h2 id="positions-title">My positions</h2>
          </div>
          <span className="proposal-count">
            {positions.length} {positions.length === 1 ? "position" : "positions"}
          </span>
        </div>
        {!publicKey || positions.length === 0 ? (
          <div className="positions-empty" aria-live="polite">
            <span className="positions-empty-icon" aria-hidden="true">
              <Wallet />
            </span>
            <div>
              <h3>
                {positionsQuery.isFetching
                  ? "Loading your positions"
                  : publicKey
                    ? "No positions yet"
                    : "Connect your wallet"}
              </h3>
              <p>
                {positionsQuery.isFetching
                  ? "Checking on-chain contributions for this wallet."
                  : publicKey
                    ? "Your pool contributions and payout status will appear here."
                    : "Connect the wallet you used to contribute from the page header to view your on-chain positions."}
              </p>
            </div>
          </div>
        ) : (
          <div className="positions-table-wrap">
            <table className="positions-table">
              <thead>
                <tr>
                  <th scope="col">Pool</th>
                  <th scope="col">Status</th>
                  <th scope="col">Contributed</th>
                  <th scope="col">Claimed</th>
                  <th scope="col">Expected payout</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const pool = pools.find((item) => item.publicKey.equals(position.account.pool));
                  const expected = pool ? expectedInvestorPayout(pool, position) : null;
                  return (
                    <tr key={position.publicKey.toBase58()}>
                      <td className="font-mono">{shortKey(position.account.pool)}</td>
                      <td>{pool ? displayStatus(pool.account.status) : "Unavailable"}</td>
                      <td>{formatUsdc(position.account.contributed)} USDC</td>
                      <td>{position.account.claimed ? "Claimed" : "Not claimed"}</td>
                      <td>{expected ? `${formatUsdc(expected)} USDC` : "Pending settlement"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="proposal-workspace" aria-labelledby="entrepreneur-proposals-title">
        <div className="proposal-workspace-heading">
          <div>
            <p className="proposal-eyebrow">FUNDING JOURNEY</p>
            <h2 id="entrepreneur-proposals-title">Entrepreneur proposals</h2>
            <p>Submit a request, follow its review, and create a pool after approval.</p>
          </div>
          <span className="proposal-review-badge">
            <ShieldCheck aria-hidden="true" />
            Platform admin review
          </span>
        </div>
        {!entrepreneurRole ? (
          <div className="workspace-empty entrepreneur-role-empty">
            <div className="icon-tile">
              <Handshake aria-hidden="true" />
            </div>
            <h2>Entrepreneur role required</h2>
            <p>
              Enable Entrepreneur in your account profile. One wallet sign-in applies to every role
              on your profile; proposal approval still requires the platform admin.
            </p>
            {profileError && <p role="alert">{profileError}</p>}
          </div>
        ) : (
          <div className="onboarding-layout proposal-layout">
            <form
              className="onboarding-card proposal-form"
              onSubmit={(event) => void submitProposal(event)}
            >
              <div className="proposal-card-heading">
                <span className="proposal-card-icon" aria-hidden="true">
                  <Handshake />
                </span>
                <div>
                  <p className="proposal-eyebrow">NEW REQUEST</p>
                  <h3>Submit a funding proposal</h3>
                  <p>Set the funding target and profit-sharing split.</p>
                </div>
              </div>
              <div className="proposal-schema-note">
                <span>What is recorded</span>
                <p>
                  The on-chain proposal stores your target, profit share, and wallet—not a business
                  description.
                </p>
              </div>
              <label className="proposal-field">
                <span>
                  Funding target <small>USDC</small>
                </span>
                <Input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={fundingGoal}
                  onChange={(event) => setFundingGoal(event.target.value)}
                  inputMode="decimal"
                  placeholder="1,000.00"
                  required
                  disabled={busy}
                />
                <small>Enter the amount you are requesting from contributors.</small>
              </label>
              <label className="proposal-field">
                <span>
                  Business term <small>Days</small>
                </span>
                <Input
                  type="number"
                  min="30"
                  max="365"
                  step="1"
                  value={termDays}
                  onChange={(event) => setTermDays(event.target.value)}
                  required
                  disabled={busy}
                />
                <small>Choose a term from 30 to 365 days.</small>
              </label>
              <label className="proposal-field">
                <span>
                  Entrepreneur profit share <small>Basis points</small>
                </span>
                <Input
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  value={entrepreneurProfitBps}
                  onChange={(event) => setEntrepreneurProfitBps(event.target.value)}
                  required
                  disabled={busy}
                />
                <small>
                  100 basis points equal 1%. Current split: <strong>{profitSharePreview}</strong>
                </small>
              </label>
              <div className="proposal-steps" aria-label="Proposal process">
                <span className="is-current">
                  <b>01</b> Submit
                </span>
                <span>
                  <b>02</b> Admin review
                </span>
                <span>
                  <b>03</b> Create pool
                </span>
              </div>
              {publicKey && anchorWallet ? (
                <Button type="submit" variant="gold" disabled={busy || !readiness.ready}>
                  {busy ? "Submitting…" : "Submit for admin approval"}
                </Button>
              ) : (
                <p className="wallet-action-hint">
                  Connect and sign in from the page header to submit a proposal.
                </p>
              )}
            </form>

            <div className="onboarding-card proposal-list-panel">
              <div className="proposal-list-heading">
                <div>
                  <p className="proposal-eyebrow">ON-CHAIN RECORDS</p>
                  <h3>Your proposals</h3>
                </div>
                <span className="proposal-count">
                  {ownProposals.length} {ownProposals.length === 1 ? "request" : "requests"}
                </span>
              </div>
              {!publicKey || ownProposals.length === 0 ? (
                <div className="proposal-list-empty" aria-live="polite">
                  <span className="proposal-list-empty-icon" aria-hidden="true">
                    {proposalsQuery.isFetching ? <Clock3 /> : <Handshake />}
                  </span>
                  <h4>
                    {proposalsQuery.isFetching
                      ? "Loading proposals"
                      : publicKey
                        ? "No proposals yet"
                        : "Connect your wallet"}
                  </h4>
                  <p>
                    {proposalsQuery.isFetching
                      ? "Reading proposal records from the program."
                      : publicKey
                        ? "Submitted proposals and their next steps will appear here."
                        : "Your proposals are linked to the wallet that submitted them."}
                  </p>
                </div>
              ) : (
                <div className="proposal-list">
                  {ownProposals.map((proposal) => {
                    const key = proposal.publicKey.toBase58();
                    const hasPool = poolByProposal.has(key);
                    const rejected = rejectedProposalKeys.has(key);
                    const approved = proposal.account.approved;
                    const status = approved ? "approved" : rejected ? "rejected" : "pending";
                    const statusLabel = approved ? "Approved" : rejected ? "Rejected" : "In review";
                    const relatedPool = pools.find((pool) =>
                      pool.account.proposal.equals(proposal.publicKey),
                    );
                    return (
                      <article key={key} className="proposal-record">
                        <div className="proposal-record-heading">
                          <div>
                            <span className="proposal-record-label">FUNDING REQUEST</span>
                            <h4>Proposal {shortKey(proposal.publicKey)}</h4>
                          </div>
                          <span className={`proposal-status is-${status}`}>
                            {approved ? (
                              <CheckCircle2 aria-hidden="true" />
                            ) : (
                              <Clock3 aria-hidden="true" />
                            )}
                            {statusLabel}
                          </span>
                        </div>
                        <div className="proposal-record-metrics">
                          <div>
                            <span>Funding target</span>
                            <strong>{formatUsdc(proposal.account.fundingGoal)} USDC</strong>
                          </div>
                          <div>
                            <span>Profit share</span>
                            <strong>
                              {formatProfitShare(proposal.account.entrepreneurProfitBps)}
                            </strong>
                          </div>
                          <div>
                            <span>Business term</span>
                            <strong>
                              {proposal.account.termSeconds === null
                                ? "Legacy record"
                                : `${proposal.account.termSeconds.div(new BN(86_400)).toString()} days`}
                            </strong>
                          </div>
                        </div>
                        <a
                          className="proposal-explorer-link"
                          href={`https://explorer.solana.com/address/${key}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View proposal on Solana Explorer <ExternalLink aria-hidden="true" />
                        </a>
                        {rejected && (
                          <p className="proposal-rejection-note">
                            The program records rejection status but does not store review notes or
                            revision instructions.
                          </p>
                        )}
                        {approved && !hasPool && (
                          <div className="proposal-next-step">
                            <p>Approved. Create your pool to make it available to contributors.</p>
                            <Button
                              type="button"
                              variant="gold"
                              disabled={busy}
                              onClick={() => void createPool(proposal)}
                            >
                              Create approved pool
                            </Button>
                          </div>
                        )}
                        {relatedPool && (
                          <div className="proposal-pool-created">
                            <CheckCircle2 aria-hidden="true" />
                            <span>Pool created</span>
                            <a
                              href={`https://explorer.solana.com/address/${relatedPool.publicKey.toBase58()}?cluster=devnet`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shortKey(relatedPool.publicKey)} <ExternalLink aria-hidden="true" />
                            </a>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <p className="risk-note">
        <CircleAlert />
        This page uses Devnet USDC. Every financial instruction requires explicit wallet
        confirmation; no proposal or account role is auto-approved.
      </p>
    </Workspace>
  );
}

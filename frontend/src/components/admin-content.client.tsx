import { BN } from "@coral-xyz/anchor";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { CONFIG_SEED, moonCreditProgramId, REJECTION_SEED } from "@/lib/mooncredit-program";
import {
  moonCreditQueryKeys,
  useAdminProposals,
  useAdminSettlements,
  useConfig,
  usePools,
  useProgram,
} from "@/lib/use-mooncredit";
import { txToast } from "@/lib/tx-toast";
import { SystemProgram, PublicKey } from "@solana/web3.js";

type LivePool = NonNullable<ReturnType<typeof usePools>["data"]>[number];

function formatUsdc(amount: BN): string {
  const whole = amount.div(new BN(1_000_000)).toString();
  const fractional = amount.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}

function shortKey(key: PublicKey): string {
  const value = key.toBase58();
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

function poolStatusName(status: LivePool["account"]["status"]): string {
  if (typeof status === "string") return status;
  return Object.keys(status)[0] ?? "unknown";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Please try again.";
}

export function AuthorityAdminLink() {
  const { publicKey } = useWallet();
  const configQuery = useConfig();
  const location = useLocation();
  if (!publicKey || !configQuery.data || !publicKey.equals(configQuery.data.authority)) return null;

  return (
    <Link to="/admin" className={location.pathname === "/admin" ? "selected" : ""}>
      <ShieldCheck />
      Admin
    </Link>
  );
}

export function AdminContentClient() {
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const program = useProgram();
  const queryClient = useQueryClient();
  const configQuery = useConfig();
  const isAuthority = Boolean(
    publicKey && configQuery.data && publicKey.equals(configQuery.data.authority),
  );
  const proposalsQuery = useAdminProposals(isAuthority ? publicKey : null);
  const settlementsQuery = useAdminSettlements(isAuthority);
  const poolsQuery = usePools();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function runTransaction(
    actionKey: string,
    successMessage: string,
    submit: (authority: PublicKey) => Promise<string>,
  ) {
    if (!publicKey || !anchorWallet) {
      toast.error("Connect the authority wallet to perform this action.");
      return;
    }

    setBusyAction(actionKey);
    try {
      const signature = await submit(publicKey);
      txToast(signature, successMessage);
      await queryClient.invalidateQueries({ queryKey: moonCreditQueryKeys.all });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function refresh() {
    try {
      await Promise.all([
        configQuery.refetch({ throwOnError: true }),
        proposalsQuery.refetch({ throwOnError: true }),
        settlementsQuery.refetch({ throwOnError: true }),
        poolsQuery.refetch({ throwOnError: true }),
      ]);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const refreshing =
    configQuery.isFetching ||
    proposalsQuery.isFetching ||
    settlementsQuery.isFetching ||
    poolsQuery.isFetching;
  const pendingProposals = proposalsQuery.data ?? [];
  const settlements = settlementsQuery.data ?? [];
  const manageablePools = (poolsQuery.data ?? []).filter(({ account }) => {
    const status = poolStatusName(account.status);
    return status === "open" || status === "funded";
  });
  const loadError =
    configQuery.error ?? proposalsQuery.error ?? settlementsQuery.error ?? poolsQuery.error;

  if (!publicKey) {
    return (
      <Workspace>
        <WorkspaceTitle
          eyebrow="PLATFORM ADMIN"
          title="Not authorized"
          description="Connect the platform authority wallet to access admin actions."
        />
      </Workspace>
    );
  }

  if (configQuery.isLoading) {
    return (
      <Workspace>
        <WorkspaceTitle
          eyebrow="PLATFORM ADMIN"
          title="Verifying authority"
          description="Checking the connected wallet against the on-chain platform configuration."
        />
      </Workspace>
    );
  }

  if (configQuery.error) {
    return (
      <Workspace>
        <WorkspaceTitle
          eyebrow="PLATFORM ADMIN"
          title="Could not verify authority"
          description={errorMessage(configQuery.error)}
        />
      </Workspace>
    );
  }

  if (!isAuthority) {
    return (
      <Workspace>
        <WorkspaceTitle
          eyebrow="PLATFORM ADMIN"
          title="Not authorized"
          description="This connected wallet is not the platform authority."
        />
      </Workspace>
    );
  }

  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="PLATFORM ADMIN"
        title="Platform administration"
        description="Review proposals, approve settlement returns, and cancel eligible pools."
      >
        <Button
          type="button"
          variant="quiet"
          disabled={refreshing || busyAction !== null}
          onClick={() => void refresh()}
        >
          <RefreshCw />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </WorkspaceTitle>

      <p className="mb-6 text-sm text-muted-foreground">
        Proposal records are not yet linked to Supabase business profiles, so private business
        details are unavailable here.
      </p>

      {loadError && (
        <p className="mb-6 text-sm text-destructive" role="alert">
          Could not load all admin data: {errorMessage(loadError)}
        </p>
      )}

      <section className="mb-10">
        <div className="workspace-section-heading">
          <h2>Pending proposals</h2>
          <span>{pendingProposals.length} pending</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Proposal</th>
                <th className="p-3">Supabase business details</th>
                <th className="p-3">Entrepreneur</th>
                <th className="p-3">Funding goal</th>
                <th className="p-3">Entrepreneur profit share</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingProposals.map(({ publicKey: proposalKey, account }) => {
                const key = proposalKey.toBase58();
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="p-3 font-mono">{shortKey(proposalKey)}</td>
                    <td className="p-3 text-muted-foreground">Not linked</td>
                    <td className="p-3 font-mono">{shortKey(account.entrepreneur)}</td>
                    <td className="p-3">{formatUsdc(account.fundingGoal)} USDC</td>
                    <td className="p-3">{(account.entrepreneurProfitBps / 100).toFixed(2)}%</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="gold"
                          disabled={busyAction !== null}
                          onClick={() =>
                            void runTransaction(
                              `approve:${key}`,
                              `Proposal ${shortKey(proposalKey)} approved.`,
                              (authority) =>
                                program.methods
                                  .approveProposal()
                                  .accounts({
                                    config: PublicKey.findProgramAddressSync(
                                      [CONFIG_SEED],
                                      moonCreditProgramId,
                                    )[0],
                                    proposal: proposalKey,
                                    rejection: PublicKey.findProgramAddressSync(
                                      [REJECTION_SEED, proposalKey.toBuffer()],
                                      moonCreditProgramId,
                                    )[0],
                                    authority,
                                  })
                                  .rpc(),
                            )
                          }
                        >
                          {busyAction === `approve:${key}` ? "Approving…" : "Approve"}
                        </Button>
                        <Button
                          type="button"
                          variant="quiet"
                          disabled={busyAction !== null}
                          onClick={() =>
                            void runTransaction(
                              `reject:${key}`,
                              `Proposal ${shortKey(proposalKey)} rejected.`,
                              (authority) =>
                                program.methods
                                  .rejectProposal()
                                  .accounts({
                                    config: PublicKey.findProgramAddressSync(
                                      [CONFIG_SEED],
                                      moonCreditProgramId,
                                    )[0],
                                    proposal: proposalKey,
                                    rejection: PublicKey.findProgramAddressSync(
                                      [REJECTION_SEED, proposalKey.toBuffer()],
                                      moonCreditProgramId,
                                    )[0],
                                    authority,
                                    systemProgram: SystemProgram.programId,
                                  })
                                  .rpc(),
                            )
                          }
                        >
                          {busyAction === `reject:${key}` ? "Rejecting…" : "Reject"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pendingProposals.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={6}>
                    No pending proposals.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <div className="workspace-section-heading">
          <h2>Settlements awaiting approval</h2>
          <span>{settlements.length} awaiting</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Pool</th>
                <th className="p-3">Returned amount</th>
                <th className="p-3">Vault balance</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(({ pool, settlement, settlementAddress, vaultBalance }) => {
                const key = pool.publicKey.toBase58();
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="p-3 font-mono">{shortKey(pool.publicKey)}</td>
                    <td className="p-3">{formatUsdc(settlement.returnedAmount)} USDC</td>
                    <td className="p-3">{formatUsdc(vaultBalance)} USDC</td>
                    <td className="p-3">
                      <Button
                        type="button"
                        variant="gold"
                        disabled={busyAction !== null}
                        onClick={() =>
                          void runTransaction(
                            `settlement:${key}`,
                            `Settlement for pool ${shortKey(pool.publicKey)} approved.`,
                            (authority) =>
                              program.methods
                                .approveSettlement()
                                .accounts({
                                  config: PublicKey.findProgramAddressSync(
                                    [CONFIG_SEED],
                                    moonCreditProgramId,
                                  )[0],
                                  pool: pool.publicKey,
                                  settlement: settlementAddress,
                                  authority,
                                })
                                .rpc(),
                          )
                        }
                      >
                        {busyAction === `settlement:${key}` ? "Approving…" : "Approve"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {settlements.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>
                    No settlements awaiting approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="workspace-section-heading">
          <h2>Open or funded pools</h2>
          <span>{manageablePools.length} eligible</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Pool</th>
                <th className="p-3">Status</th>
                <th className="p-3">Funding goal</th>
                <th className="p-3">Contributed</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {manageablePools.map(({ publicKey: poolKey, account }) => {
                const key = poolKey.toBase58();
                return (
                  <tr key={key} className="border-t border-border">
                    <td className="p-3 font-mono">{shortKey(poolKey)}</td>
                    <td className="p-3">{poolStatusName(account.status)}</td>
                    <td className="p-3">{formatUsdc(account.fundingGoal)} USDC</td>
                    <td className="p-3">{formatUsdc(account.totalContributed)} USDC</td>
                    <td className="p-3">
                      <Button
                        type="button"
                        variant="quiet"
                        disabled={busyAction !== null}
                        onClick={() =>
                          void runTransaction(
                            `cancel:${key}`,
                            `Pool ${shortKey(poolKey)} cancelled.`,
                            (authority) =>
                              program.methods
                                .cancelPool()
                                .accounts({
                                  config: PublicKey.findProgramAddressSync(
                                    [CONFIG_SEED],
                                    moonCreditProgramId,
                                  )[0],
                                  pool: poolKey,
                                  authority,
                                })
                                .rpc(),
                          )
                        }
                      >
                        {busyAction === `cancel:${key}` ? "Cancelling…" : "Cancel"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {manageablePools.length === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={5}>
                    No open or funded pools.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Workspace>
  );
}

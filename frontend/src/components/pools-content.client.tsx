import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CircleAlert, ExternalLink, Handshake, RefreshCw, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletConnectButton } from "@/components/wallet/wallet-connect";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";
import {
  CONFIG_SEED,
  ENTREPRENEUR_SEED,
  getMoonCreditProgramReadiness,
  moonCreditIdl,
  moonCreditProgramId,
  moonCreditUsdcMint,
  POOL_SEED,
  POSITION_SEED,
  PROPOSAL_SEED,
  VAULT_SEED,
} from "@/lib/mooncredit-program";
import { parseUsdcAmount, validateContributionAmount } from "@/lib/pool-utils";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";

type ProposalData = {
  entrepreneur: PublicKey;
  businessId: number[];
  fundingGoal: BN;
  entrepreneurProfitBps: number;
  approved: boolean;
};

type PoolData = {
  proposal: PublicKey;
  entrepreneur: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
  fundingGoal: BN;
  totalContributed: BN;
  status: Record<string, unknown> | string;
  investorCount: number;
};

type ChainAccount<T> = { publicKey: PublicKey; account: T };
type ProgramArg = BN | number | number[];

type PoolProposal = ChainAccount<ProposalData>;
type LivePool = ChainAccount<PoolData>;

const readOnlyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("Connect a wallet to submit a transaction.");
  },
  signAllTransactions: async () => {
    throw new Error("Connect a wallet to submit a transaction.");
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getAccountClient(program: Program, name: string): Record<string, unknown> {
  const client = Reflect.get(program.account, name);
  if (!isRecord(client)) throw new Error(`The program IDL does not include account ${name}.`);
  return client;
}

async function fetchNullableAccount(
  program: Program,
  name: string,
  address: PublicKey,
): Promise<unknown> {
  const client = getAccountClient(program, name);
  const fetchNullable = Reflect.get(client, "fetchNullable");
  if (typeof fetchNullable !== "function") throw new Error(`Account ${name} cannot be fetched.`);
  const result: unknown = await Reflect.apply(fetchNullable, client, [address]);
  return result;
}

async function fetchAllAccounts(program: Program, name: string): Promise<ChainAccount<unknown>[]> {
  const client = getAccountClient(program, name);
  const all = Reflect.get(client, "all");
  if (typeof all !== "function") throw new Error(`Account ${name} cannot be listed.`);
  const rows: unknown = await Reflect.apply(all, client, []);
  if (!Array.isArray(rows)) throw new Error(`Account ${name} returned invalid list data.`);
  return rows.filter(
    (row): row is ChainAccount<unknown> =>
      isRecord(row) && row["publicKey"] instanceof PublicKey && "account" in row,
  );
}

async function callProgramMethod(
  program: Program,
  name: string,
  args: ProgramArg[],
  accounts: Record<string, PublicKey>,
  resultType: "rpc" | "instruction",
): Promise<string | TransactionInstruction> {
  const method = Reflect.get(program.methods, name);
  if (typeof method !== "function")
    throw new Error(`The program IDL does not include instruction ${name}.`);
  const builder: unknown = Reflect.apply(method, program.methods, args);
  if (!isRecord(builder)) throw new Error(`Could not create instruction ${name}.`);
  const accountsMethod = Reflect.get(builder, "accounts");
  if (typeof accountsMethod !== "function")
    throw new Error(`Instruction ${name} has no account resolver.`);
  const accountBuilder: unknown = Reflect.apply(accountsMethod, builder, [accounts]);
  if (!isRecord(accountBuilder)) throw new Error(`Could not resolve accounts for ${name}.`);
  const action = Reflect.get(accountBuilder, resultType);
  if (typeof action !== "function") throw new Error(`Instruction ${name} cannot ${resultType}.`);
  const result: unknown = await Reflect.apply(action, accountBuilder, []);
  if (resultType === "instruction" && result instanceof TransactionInstruction) return result;
  if (resultType === "rpc" && typeof result === "string") return result;
  throw new Error(`Instruction ${name} returned an invalid ${resultType} result.`);
}

function parseProposal(value: ChainAccount<unknown>): PoolProposal | null {
  if (!isRecord(value.account)) return null;
  const account = value.account;
  const rawBusinessId = account["businessId"];
  const businessId = Array.isArray(rawBusinessId)
    ? rawBusinessId.filter(
        (item): item is number => Number.isInteger(item) && item >= 0 && item <= 255,
      )
    : [];
  const entrepreneur = account["entrepreneur"];
  const fundingGoal = account["fundingGoal"];
  const profitBps = account["entrepreneurProfitBps"];
  const approved = account["approved"];
  if (
    !(entrepreneur instanceof PublicKey) ||
    businessId.length !== 32 ||
    !(fundingGoal instanceof BN) ||
    typeof profitBps !== "number" ||
    typeof approved !== "boolean"
  ) {
    return null;
  }
  return {
    publicKey: value.publicKey,
    account: {
      entrepreneur,
      businessId,
      fundingGoal,
      entrepreneurProfitBps: profitBps,
      approved,
    },
  };
}

function parsePool(value: ChainAccount<unknown>): LivePool | null {
  if (!isRecord(value.account)) return null;
  const account = value.account;
  const proposal = account["proposal"];
  const entrepreneur = account["entrepreneur"];
  const mint = account["mint"];
  const vault = account["vault"];
  const fundingGoal = account["fundingGoal"];
  const totalContributed = account["totalContributed"];
  const status = account["status"];
  const investorCount = account["investorCount"];
  if (
    !(proposal instanceof PublicKey) ||
    !(entrepreneur instanceof PublicKey) ||
    !(mint instanceof PublicKey) ||
    !(vault instanceof PublicKey) ||
    !(fundingGoal instanceof BN) ||
    !(totalContributed instanceof BN) ||
    (!isRecord(status) && typeof status !== "string") ||
    typeof investorCount !== "number"
  ) {
    return null;
  }
  return {
    publicKey: value.publicKey,
    account: {
      proposal,
      entrepreneur,
      mint,
      vault,
      fundingGoal,
      totalContributed,
      status,
      investorCount,
    },
  };
}

function formatUsdc(amount: BN): string {
  const whole = amount.div(new BN(1_000_000)).toString();
  const fractional = amount.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole;
}

function shortKey(key: PublicKey): string {
  const value = key.toBase58();
  return `${value.slice(0, 5)}…${value.slice(-5)}`;
}

function statusName(status: PoolData["status"]): string {
  if (typeof status === "string") return status;
  return Object.keys(status)[0] ?? "unknown";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Please try again.";
}

export function PoolsContentClient() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const provider = useMemo(
    () =>
      new AnchorProvider(connection, anchorWallet ?? readOnlyWallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }),
    [anchorWallet, connection],
  );
  const program = useMemo(() => new Program(moonCreditIdl, provider), [provider]);
  const [pools, setPools] = useState<LivePool[]>([]);
  const [proposals, setProposals] = useState<PoolProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [recentSignature, setRecentSignature] = useState("");
  const [entrepreneurRole, setEntrepreneurRole] = useState(false);
  const [fundingGoal, setFundingGoal] = useState("");
  const [entrepreneurProfitBps, setEntrepreneurProfitBps] = useState("2000");
  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const configAddress = PublicKey.findProgramAddressSync([CONFIG_SEED], moonCreditProgramId)[0];
      const config = await fetchNullableAccount(program, "platformConfig", configAddress);
      if (!config || !isRecord(config) || !(config["usdcMint"] instanceof PublicKey)) {
        throw new Error("MoonCreditFi is not initialized on Devnet.");
      }
      if (!config["usdcMint"].equals(moonCreditUsdcMint)) {
        throw new Error(
          "The deployed program's USDC mint does not match the configured Devnet mint.",
        );
      }
      const mintInfo = await getMint(connection, moonCreditUsdcMint, "confirmed");
      if (mintInfo.decimals !== 6) {
        throw new Error("The configured Devnet USDC mint must use six decimal places.");
      }

      const [poolRows, proposalRows] = await Promise.all([
        fetchAllAccounts(program, "mudarabahPool"),
        fetchAllAccounts(program, "businessProposal"),
      ]);
      const parsedPools = poolRows.map(parsePool).filter((row): row is LivePool => row !== null);
      const parsedProposals = proposalRows
        .map(parseProposal)
        .filter((row): row is PoolProposal => row !== null);
      setPools(parsedPools);
      setProposals(parsedProposals);
    } catch (loadError) {
      setPools([]);
      setProposals([]);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [connection, program]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      toast.error("Sign in with Solana and connect your wallet to submit a proposal.");
      return;
    }
    if (!entrepreneurRole) {
      toast.error("Select the entrepreneur role in your profile before submitting a proposal.");
      return;
    }
    let goal: BN;
    const share = Number(entrepreneurProfitBps);
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

    setBusy(true);
    try {
      const entrepreneurProfile = PublicKey.findProgramAddressSync(
        [ENTREPRENEUR_SEED, publicKey.toBuffer()],
        moonCreditProgramId,
      )[0];
      const existingProfile = await fetchNullableAccount(
        program,
        "entrepreneurProfile",
        entrepreneurProfile,
      );
      if (!existingProfile) {
        await callProgramMethod(
          program,
          "registerEntrepreneur",
          [],
          { entrepreneurProfile, entrepreneur: publicKey, systemProgram: SystemProgram.programId },
          "rpc",
        );
      }

      const businessId = Array.from(window.crypto.getRandomValues(new Uint8Array(32)));
      const proposalAddress = PublicKey.findProgramAddressSync(
        [PROPOSAL_SEED, publicKey.toBuffer(), Uint8Array.from(businessId)],
        moonCreditProgramId,
      )[0];
      const signature = await callProgramMethod(
        program,
        "createProposal",
        [businessId, goal, share],
        {
          entrepreneurProfile,
          proposal: proposalAddress,
          entrepreneur: publicKey,
          systemProgram: SystemProgram.programId,
        },
        "rpc",
      );
      if (typeof signature !== "string")
        throw new Error("Proposal transaction signature was not returned.");
      setRecentSignature(signature);
      toast.success(
        `Proposal submitted: ${shortKey(proposalAddress)}. It requires admin approval.`,
      );
      setFundingGoal("");
      await refresh();
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
      const signature = await callProgramMethod(
        program,
        "createPool",
        [],
        {
          config: PublicKey.findProgramAddressSync([CONFIG_SEED], moonCreditProgramId)[0],
          proposal: proposal.publicKey,
          pool: poolAddress,
          vault: vaultAddress,
          usdcMint: moonCreditUsdcMint,
          entrepreneur: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        },
        "rpc",
      );
      if (typeof signature !== "string")
        throw new Error("Pool transaction signature was not returned.");
      setRecentSignature(signature);
      toast.success(`Pool created: ${shortKey(poolAddress)}.`);
      await refresh();
    } catch (createError) {
      toast.error(errorMessage(createError));
    } finally {
      setBusy(false);
    }
  }

  async function contribute(pool: LivePool) {
    if (!publicKey || !anchorWallet) {
      toast.error("Sign in with Solana and connect your wallet to contribute.");
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
      const instruction = await callProgramMethod(
        program,
        "contribute",
        [amount],
        {
          pool: pool.publicKey,
          position,
          investorTokenAccount,
          vault: pool.account.vault,
          usdcMint: moonCreditUsdcMint,
          investor: publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
        "instruction",
      );
      if (!(instruction instanceof TransactionInstruction)) {
        throw new Error("The contribution instruction could not be constructed.");
      }
      transaction.add(instruction);
      const signature = await provider.sendAndConfirm(transaction);
      setRecentSignature(signature);
      toast.success(`USDC contribution confirmed: ${shortKey(pool.publicKey)}.`);
      setContributionAmounts((current) => ({ ...current, [pool.publicKey.toBase58()]: "" }));
      await refresh();
    } catch (contributeError) {
      toast.error(errorMessage(contributeError));
    } finally {
      setBusy(false);
    }
  }

  const poolByProposal = useMemo(
    () => new Set(pools.map((pool) => pool.account.proposal.toBase58())),
    [pools],
  );
  const ownProposals = publicKey
    ? proposals.filter((proposal) => proposal.account.entrepreneur.equals(publicKey))
    : [];
  const readiness = getMoonCreditProgramReadiness();

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

      <div className="workspace-section-heading">
        <h2>Pool activity</h2>
        <span>Solana {SOLANA_NETWORK} · USDC</span>
      </div>
      <div className="workspace-principles">
        <div>
          <Handshake />
          <h3>Verified program</h3>
          <p>
            <a
              href={`https://explorer.solana.com/address/${moonCreditProgramId.toBase58()}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
            >
              {shortKey(moonCreditProgramId)} <ExternalLink size={13} />
            </a>
          </p>
        </div>
        <div>
          <Wallet />
          <h3>Configured mint</h3>
          <p>{shortKey(moonCreditUsdcMint)}</p>
        </div>
        <div>
          <CircleAlert />
          <h3>Returns at risk</h3>
          <p>Funding and returns are not guaranteed. Review the terms before signing.</p>
        </div>
      </div>

      {!readiness.ready && <p className="risk-note">{readiness.reason}</p>}
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
        <section className="onboarding-layout" aria-label="Live pools">
          {pools.map((pool) => {
            const target = pool.account.fundingGoal;
            const raised = pool.account.totalContributed;
            const remaining = target.sub(raised);
            const open =
              statusName(pool.account.status).toLowerCase() === "open" && remaining.gt(new BN(0));
            const poolKey = pool.publicKey.toBase58();
            return (
              <article className="onboarding-card" key={poolKey}>
                <h2>Pool {shortKey(pool.publicKey)}</h2>
                <p>
                  Proposal {shortKey(pool.account.proposal)} · {statusName(pool.account.status)}
                </p>
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
                    Contribute USDC
                  </Button>
                ) : (
                  <WalletConnectButton />
                )}
              </article>
            );
          })}
        </section>
      )}

      <div className="workspace-section-heading">
        <h2>Entrepreneur proposals</h2>
        <span>Admin approval required</span>
      </div>
      {!entrepreneurRole ? (
        <div className="workspace-empty">
          <h2>Entrepreneur role required</h2>
          <p>
            Sign in with Solana, then select the entrepreneur role in your profile. The role does
            not approve proposals automatically.
          </p>
          {profileError && <p role="alert">{profileError}</p>}
          <Button asChild variant="quiet">
            <Link to="/auth">Sign in with Solana</Link>
          </Button>
        </div>
      ) : (
        <section className="onboarding-layout">
          <form
            className="onboarding-card space-y-4"
            onSubmit={(event) => void submitProposal(event)}
          >
            <h2>Submit a funding proposal</h2>
            <p>
              The deployed program stores the target, profit-share basis points, and wallet—not a
              business description. Proposal approval is performed by the platform authority.
            </p>
            <label className="block space-y-2">
              <span>Funding target (USDC)</span>
              <Input
                value={fundingGoal}
                onChange={(event) => setFundingGoal(event.target.value)}
                inputMode="decimal"
                placeholder="1000.00"
                required
                disabled={busy}
              />
            </label>
            <label className="block space-y-2">
              <span>Entrepreneur profit share (basis points)</span>
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
            </label>
            {publicKey && anchorWallet ? (
              <Button type="submit" variant="gold" disabled={busy || !readiness.ready}>
                {busy ? "Submitting…" : "Submit for admin approval"}
              </Button>
            ) : (
              <WalletConnectButton />
            )}
          </form>

          <div className="onboarding-card">
            <h2>Your proposals</h2>
            {!publicKey || ownProposals.length === 0 ? (
              <p>No proposals for this connected wallet.</p>
            ) : (
              <div className="space-y-4">
                {ownProposals.map((proposal) => {
                  const key = proposal.publicKey.toBase58();
                  const hasPool = poolByProposal.has(key);
                  return (
                    <article key={key} className="border-b border-border pb-4">
                      <h3>Proposal {shortKey(proposal.publicKey)}</h3>
                      <p>Target: {formatUsdc(proposal.account.fundingGoal)} USDC</p>
                      <p>
                        {proposal.account.approved
                          ? "Approved by platform authority"
                          : "Awaiting platform authority review"}
                      </p>
                      {proposal.account.approved && !hasPool && (
                        <Button
                          type="button"
                          variant="gold"
                          disabled={busy}
                          onClick={() => void createPool(proposal)}
                        >
                          Create approved pool
                        </Button>
                      )}
                      {hasPool && (
                        <p>
                          Pool created:{" "}
                          {shortKey(
                            pools.find((pool) => pool.account.proposal.equals(proposal.publicKey))!
                              .publicKey,
                          )}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
      <p className="risk-note">
        <CircleAlert />
        This page uses Devnet USDC. Every financial instruction requires explicit wallet
        confirmation; no proposal or account role is auto-approved.
      </p>
    </Workspace>
  );
}

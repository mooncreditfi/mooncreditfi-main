import { BN } from "@coral-xyz/anchor";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import type { Mooncreditfi } from "@/idl/mooncreditfi";
import { moonCreditIdl, moonCreditProgramId, moonCreditUsdcMint } from "@/lib/mooncredit-program";

type PoolAccount = {
  proposal: PublicKey;
  entrepreneur: PublicKey;
  mint: PublicKey;
  fundingGoal: BN;
  totalContributed: BN;
  entrepreneurProfitBps: number;
  status: string | Record<string, unknown>;
};
type ProposalAccount = {
  entrepreneur: PublicKey;
  fundingGoal: BN;
  entrepreneurProfitBps: number;
  approved: boolean;
};
export type FundingVerificationChecks = {
  poolFound: boolean;
  proposalFound: boolean;
  proposalApproved: boolean;
  entrepreneurMatches: boolean;
  fundingGoalMatches: boolean;
  profitShareMatches: boolean;
  usdcMintMatches: boolean;
  poolOpen: boolean;
  fundingRemaining: boolean;
};
export type FundingVerification = {
  verified: boolean;
  checks: FundingVerificationChecks;
  errors: string[];
  poolAddress: PublicKey;
  proposalAddress: PublicKey | null;
  pool: PoolAccount | null;
  proposal: ProposalAccount | null;
};

const emptyChecks = (): FundingVerificationChecks => ({
  poolFound: false,
  proposalFound: false,
  proposalApproved: false,
  entrepreneurMatches: false,
  fundingGoalMatches: false,
  profitShareMatches: false,
  usdcMintMatches: false,
  poolOpen: false,
  fundingRemaining: false,
});
function statusName(status: PoolAccount["status"]): string {
  return typeof status === "string"
    ? status.toLowerCase()
    : (Object.keys(status)[0]?.toLowerCase() ?? "unknown");
}

/**
 * Validate decoded, confirmed on-chain terms without coercing token amounts or basis points to floats.
 * Exposed independently so mismatch and closed-pool behavior can be unit tested without RPC fixtures.
 */
export function evaluateFundingTerms(
  poolAddress: PublicKey,
  pool: PoolAccount,
  proposalAddress: PublicKey,
  proposal: ProposalAccount,
): FundingVerification {
  const checks: FundingVerificationChecks = {
    poolFound: true,
    proposalFound: true,
    proposalApproved: proposal.approved,
    entrepreneurMatches: pool.entrepreneur.equals(proposal.entrepreneur),
    fundingGoalMatches: pool.fundingGoal.eq(proposal.fundingGoal),
    profitShareMatches: pool.entrepreneurProfitBps === proposal.entrepreneurProfitBps,
    usdcMintMatches: pool.mint.equals(moonCreditUsdcMint),
    poolOpen: statusName(pool.status) === "open",
    fundingRemaining: pool.totalContributed.lt(pool.fundingGoal),
  };
  const labels: readonly (readonly [keyof FundingVerificationChecks, string])[] = [
    ["proposalApproved", "The on-chain proposal is not approved."],
    ["entrepreneurMatches", "The entrepreneur wallet differs between the pool and proposal."],
    ["fundingGoalMatches", "Pool and proposal funding targets do not match."],
    ["profitShareMatches", "Pool and proposal entrepreneur profit shares do not match."],
    ["usdcMintMatches", "The pool mint does not match the configured MoonCreditFi USDC mint."],
    ["poolOpen", `The pool is ${statusName(pool.status)}, not open for contributions.`],
    ["fundingRemaining", "The pool funding goal has already been reached."],
  ];
  const errors = labels.filter(([key]) => !checks[key]).map(([, label]) => label);
  return {
    verified: errors.length === 0,
    checks,
    errors,
    poolAddress,
    proposalAddress,
    pool,
    proposal,
  };
}

function accountDiscriminator(name: "mudarabahPool" | "businessProposal") {
  const account = moonCreditIdl.accounts.find((item) => item.name === name);
  if (!account) throw new Error(`Bundled IDL is missing ${name}.`);
  return Uint8Array.from(account.discriminator);
}
function assertOwnedAndDiscriminated(
  info: Awaited<ReturnType<Connection["getAccountInfo"]>>,
  address: PublicKey,
  name: "mudarabahPool" | "businessProposal",
) {
  if (!info)
    throw new Error(`${name} account ${address.toBase58()} was not found on Solana ${"Devnet"}.`);
  if (!info.owner.equals(moonCreditProgramId))
    throw new Error(`${name} account is not owned by the configured MoonCreditFi program.`);
  const expected = accountDiscriminator(name);
  if (
    info.data.length < expected.length ||
    expected.some((byte, index) => info.data[index] !== byte)
  ) {
    throw new Error(
      `${name} account discriminator does not match the checked-in MoonCreditFi IDL.`,
    );
  }
}

/** Fetch and decode both accounts from confirmed RPC state. Any RPC/layout error fails closed. */
export async function fetchFundingVerification(
  connection: Connection,
  program: Program<Mooncreditfi>,
  poolAddress: PublicKey,
): Promise<FundingVerification> {
  const checks = emptyChecks();
  let proposalAddress: PublicKey | null = null;
  let pool: PoolAccount | null = null;
  let proposal: ProposalAccount | null = null;
  try {
    const poolInfo = await connection.getAccountInfo(poolAddress, "confirmed");
    assertOwnedAndDiscriminated(poolInfo, poolAddress, "mudarabahPool");
    checks.poolFound = true;
    pool = program.coder.accounts.decode("mudarabahPool", poolInfo!.data) as PoolAccount;
    proposalAddress = pool.proposal;
    const proposalInfo = await connection.getAccountInfo(proposalAddress, "confirmed");
    assertOwnedAndDiscriminated(proposalInfo, proposalAddress, "businessProposal");
    checks.proposalFound = true;
    proposal = program.coder.accounts.decode(
      "businessProposal",
      proposalInfo!.data,
    ) as ProposalAccount;
    return evaluateFundingTerms(poolAddress, pool, proposalAddress, proposal);
  } catch (error) {
    return {
      verified: false,
      checks,
      errors: [
        error instanceof Error ? error.message : "Could not verify the on-chain pool and proposal.",
      ],
      poolAddress,
      proposalAddress,
      pool,
      proposal,
    };
  }
}

/** Structural IDL guard. It does not claim that a source checkout proves the deployed binary's ABI. */
export function checkFundingVerificationIdl() {
  const required: Record<string, string[]> = {
    mudarabahPool: [
      "proposal",
      "entrepreneur",
      "mint",
      "fundingGoal",
      "totalContributed",
      "entrepreneurProfitBps",
      "status",
    ],
    businessProposal: ["entrepreneur", "fundingGoal", "entrepreneurProfitBps", "approved"],
  };
  const issues = Object.entries(required).flatMap(([name, expected]) => {
    const accountType = moonCreditIdl.types.find((type) => type.name === name);
    if (!accountType || accountType.type.kind !== "struct")
      return [`${name} struct is missing from the IDL`];
    const actual = new Set<string>(accountType.type.fields.map((field) => field.name));
    return expected
      .filter((field) => !actual.has(field))
      .map((field) => `${name}.${field} is missing from the IDL`);
  });
  return issues.length
    ? { compatible: false as const, issues }
    : { compatible: true as const, issues: [] as string[] };
}

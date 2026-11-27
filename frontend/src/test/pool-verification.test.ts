import { BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { moonCreditIdl, moonCreditProgramId, moonCreditUsdcMint } from "@/lib/mooncredit-program";
import { checkFundingVerificationIdl, evaluateFundingTerms } from "@/lib/pool-verification";

const key = (n: number) => new PublicKey(Uint8Array.from({ length: 32 }, (_, i) => (n + i) % 255));
const basePool = (overrides: Record<string, unknown> = {}) => ({
  proposal: key(10),
  entrepreneur: key(40),
  mint: moonCreditUsdcMint,
  fundingGoal: new BN("1000000000"),
  totalContributed: new BN("250000000"),
  entrepreneurProfitBps: 2000,
  status: { open: {} },
  ...overrides,
});
const baseProposal = (overrides: Record<string, unknown> = {}) => ({
  entrepreneur: key(40),
  fundingGoal: new BN("1000000000"),
  entrepreneurProfitBps: 2000,
  approved: true,
  ...overrides,
});

describe("on-chain funding verification", () => {
  it("requires matching approved pool/proposal terms and an open, under-target pool", () => {
    const result = evaluateFundingTerms(
      key(1),
      basePool() as never,
      key(10),
      baseProposal() as never,
    );
    expect(result.verified).toBe(true);
    expect(result.checks.fundingRemaining).toBe(true);
  });
  it("fails closed for funding target mismatch", () => {
    const result = evaluateFundingTerms(
      key(1),
      basePool() as never,
      key(10),
      baseProposal({ fundingGoal: new BN("1000000001") }) as never,
    );
    expect(result.verified).toBe(false);
    expect(result.checks.fundingGoalMatches).toBe(false);
  });
  it("fails closed for profit-share mismatch", () => {
    const result = evaluateFundingTerms(
      key(1),
      basePool() as never,
      key(10),
      baseProposal({ entrepreneurProfitBps: 1999 }) as never,
    );
    expect(result.verified).toBe(false);
    expect(result.checks.profitShareMatches).toBe(false);
  });
  it("fails closed for unapproved proposals, mismatched entrepreneurs, closed pools and reached goals", () => {
    for (const [pool, proposal] of [
      [basePool(), baseProposal({ approved: false })],
      [basePool({ entrepreneur: key(90) }), baseProposal()],
      [basePool({ status: { cancelled: {} } }), baseProposal()],
      [basePool({ totalContributed: new BN("1000000000") }), baseProposal()],
    ]) {
      expect(evaluateFundingTerms(key(1), pool as never, key(10), proposal as never).verified).toBe(
        false,
      );
    }
  });
  it("checks the critical pool/proposal fields exist in the bundled IDL without mutating it", () => {
    expect(checkFundingVerificationIdl()).toEqual({ compatible: true, issues: [] });
    expect(moonCreditIdl.address).toBe(moonCreditProgramId.toBase58());
  });
  it("does not claim account fetch succeeded when the RPC connection is unavailable", async () => {
    const connection = {
      getAccountInfo: async () => {
        throw new Error("RPC unavailable");
      },
    } as unknown as Connection;
    const fakeProgram = { programId: moonCreditProgramId } as never;
    const { fetchFundingVerification } = await import("@/lib/pool-verification");
    const result = await fetchFundingVerification(connection, fakeProgram, key(1));
    expect(result.verified).toBe(false);
    expect(result.checks.poolFound).toBe(false);
    expect(result.errors[0]).toContain("RPC unavailable");
  });
});

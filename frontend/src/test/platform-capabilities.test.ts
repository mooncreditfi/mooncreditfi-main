import { describe, expect, it } from "vitest";
import {
  getReputationSignal,
  MOONCREDIT_PROGRAM_ID,
  MOONCREDIT_USDC_MINT,
  platformCapabilities,
  SOLANA_NETWORK,
} from "@/lib/platform-capabilities";
import { getMoonCreditProgramReadiness, moonCreditProgramId } from "@/lib/mooncredit-program";

describe("Financial integration boundaries", () => {
  it("uses Solana Devnet for the initial environment", () => {
    expect(SOLANA_NETWORK).toBe("devnet");
  });
  it("uses the confirmed MoonCreditFi Devnet program ID", () => {
    expect(MOONCREDIT_PROGRAM_ID).toBe("6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx");
    expect(moonCreditProgramId.toBase58()).toBe(MOONCREDIT_PROGRAM_ID);
  });
  it("uses the Devnet USDC mint configured by the deployed program", () => {
    expect(MOONCREDIT_USDC_MINT).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  });
  it("enables supported pool operations only for the matching Anchor IDL", () => {
    expect(getMoonCreditProgramReadiness()).toEqual({ ready: true });
    expect(platformCapabilities.contractTransactions).toBe(true);
  });
  it("enables native Supabase Web3 authentication", () => {
    expect(platformCapabilities.walletAuthentication).toBe(true);
  });
  it("never invents CredLayer reputation data", () => {
    expect(getReputationSignal()).toBeNull();
  });
  it("blocks confidential document intake before secure processing exists", () => {
    expect(platformCapabilities.documentIntake).toBe(false);
  });
});

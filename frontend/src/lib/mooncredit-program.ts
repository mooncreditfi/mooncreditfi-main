import { PublicKey } from "@solana/web3.js";
import type { Idl } from "@coral-xyz/anchor";
import idl from "@/idl/mooncreditfi.json";
import { MOONCREDIT_PROGRAM_ID, MOONCREDIT_USDC_MINT } from "@/lib/platform-capabilities";

export const moonCreditIdl = idl as Idl;
export const moonCreditProgramId = new PublicKey(MOONCREDIT_PROGRAM_ID);
export const moonCreditUsdcMint = new PublicKey(MOONCREDIT_USDC_MINT);
const encoder = new TextEncoder();
export const CONFIG_SEED = encoder.encode("config");
export const ENTREPRENEUR_SEED = encoder.encode("entrepreneur");
export const PROPOSAL_SEED = encoder.encode("proposal");
export const POOL_SEED = encoder.encode("pool");
export const VAULT_SEED = encoder.encode("vault");
export const POSITION_SEED = encoder.encode("position");

export type MoonCreditProgramReadiness = { ready: true } | { ready: false; reason: string };

export function getMoonCreditProgramReadiness(): MoonCreditProgramReadiness {
  if (
    moonCreditIdl.address !== MOONCREDIT_PROGRAM_ID ||
    moonCreditIdl.metadata.name !== "mooncreditfi"
  ) {
    return { ready: false, reason: "The bundled IDL does not describe the MoonCreditFi program." };
  }
  const instructionNames = new Set(
    moonCreditIdl.instructions.map((instruction) => instruction.name),
  );
  const missing = ["registerEntrepreneur", "createProposal", "createPool", "contribute"].filter(
    (name) => !instructionNames.has(name),
  );
  if (missing.length > 0) {
    return {
      ready: false,
      reason: `The bundled IDL is missing: ${missing.join(", ")}.`,
    };
  }
  if (!moonCreditIdl.accounts?.some((account) => account.name === "PlatformConfig")) {
    return {
      ready: false,
      reason: "The bundled IDL is missing the platform configuration account.",
    };
  }
  return { ready: true };
}

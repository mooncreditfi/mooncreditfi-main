import { PublicKey } from "@solana/web3.js";
import { IDL } from "@/idl/mooncreditfi";
import { MOONCREDIT_PROGRAM_ID, MOONCREDIT_USDC_MINT } from "@/lib/platform-capabilities";

export const moonCreditIdl = IDL;
export const moonCreditProgramId = new PublicKey(MOONCREDIT_PROGRAM_ID);
export const moonCreditUsdcMint = new PublicKey(MOONCREDIT_USDC_MINT);
const encoder = new TextEncoder();
export const CONFIG_SEED = encoder.encode("config");
export const ENTREPRENEUR_SEED = encoder.encode("entrepreneur");
export const PROPOSAL_SEED = encoder.encode("proposal");
export const REJECTION_SEED = encoder.encode("rejection");
export const POOL_SEED = encoder.encode("pool");
export const VAULT_SEED = encoder.encode("vault");
export const POSITION_SEED = encoder.encode("position");
export const SETTLEMENT_SEED = encoder.encode("settlement");

export type MoonCreditProgramReadiness = { ready: true } | { ready: false; reason: string };
export type ProposalInstructionCompatibility = { ready: true } | { ready: false; reason: string };

const proposalInstructionAccounts = {
  approveProposal: ["config", "proposal", "rejection", "authority"],
  rejectProposal: ["config", "proposal", "rejection", "authority", "systemProgram"],
} as const;

export function checkProposalInstructionCompatibility(
  instructions: readonly { name: string; accounts: readonly { name: string }[] }[],
): ProposalInstructionCompatibility {
  const issues = Object.entries(proposalInstructionAccounts).flatMap(([name, expectedAccounts]) => {
    const instruction = instructions.find((candidate) => candidate.name === name);
    if (!instruction) return [`${name} is missing`];

    const actualAccounts = instruction.accounts.map((account) => account.name);
    if (actualAccounts.join(",") !== expectedAccounts.join(",")) {
      return [`${name} has an outdated account layout`];
    }

    return [];
  });

  if (issues.length > 0) {
    return {
      ready: false,
      reason: `The deployed program is incompatible with proposal decisions (${issues.join("; ")}). Upgrade the program and publish its matching IDL before approving or rejecting proposals.`,
    };
  }

  return { ready: true };
}

export function getMoonCreditProgramReadiness(): MoonCreditProgramReadiness {
  if (
    moonCreditIdl.address !== MOONCREDIT_PROGRAM_ID ||
    moonCreditIdl.metadata.name !== "mooncreditfi"
  ) {
    return { ready: false, reason: "The bundled IDL does not describe the MoonCreditFi program." };
  }
  const instructionNames = new Set<string>(
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
  if (!moonCreditIdl.accounts?.some((account) => account.name === "platformConfig")) {
    return {
      ready: false,
      reason: "The bundled IDL is missing the platform configuration account.",
    };
  }
  return { ready: true };
}

export const SOLANA_NETWORK = "devnet" as const;
export const MOONCREDIT_PROGRAM_ID = "6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx";
export const MOONCREDIT_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const platformCapabilities = {
  walletAuthentication: true,
  accountAccess: true,
  contractTransactions: true,
  documentIntake: false,
  reputationSignals: false,
} as const;

export function getReputationSignal(): null {
  return null;
}

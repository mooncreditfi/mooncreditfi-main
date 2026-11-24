export const SOLANA_NETWORK = 'devnet' as const;
export const MOONCREDIT_PROGRAM_ID = '6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx';

// No program ID, IDL, mint or reputation score is fabricated as a fallback.
export const platformCapabilities = {
  walletAuthentication: true,
  accountAccess: true,
  contractTransactions: false,
  documentIntake: false,
  reputationSignals: false,
} as const;

export type PoolOperation = 'create' | 'contribute' | 'activate' | 'disburse' | 'settle' | 'claim' | 'refund';

export async function executePoolOperation(_operation: PoolOperation): Promise<never> {
  throw new Error('Pool operations are unavailable until a verified Anchor program is configured.');
}

export function getReputationSignal(): null {
  return null;
}
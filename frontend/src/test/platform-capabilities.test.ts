import { describe, expect, it } from 'vitest';
import { executePoolOperation, getReputationSignal, MOONCREDIT_PROGRAM_ID, platformCapabilities, SOLANA_NETWORK, type PoolOperation } from '@/lib/platform-capabilities';
import { getMoonCreditProgramReadiness, moonCreditProgramId } from '@/lib/mooncredit-program';

describe('Financial integration boundaries', () => {
  it('uses Solana Devnet for the initial environment', () => {
    expect(SOLANA_NETWORK).toBe('devnet');
  });
  it('uses the confirmed MoonCreditFi Devnet program ID', () => {
    expect(MOONCREDIT_PROGRAM_ID).toBe('6LVAYFDRrTHSiHZqMWr4tybZNRi755HsoHgeku985pYx');
    expect(moonCreditProgramId.toBase58()).toBe(MOONCREDIT_PROGRAM_ID);
  });
  it('requires deployed mint verification before enabling contract operations', () => {
    expect(getMoonCreditProgramReadiness()).toEqual({
      ready: false,
      reason: 'A verified deployed USDC mint is required before contract transactions can be enabled.',
    });
  });
  it('enables native Supabase Web3 authentication', () => {
    expect(platformCapabilities.walletAuthentication).toBe(true);
  });
  it.each<PoolOperation>(['create', 'contribute', 'activate', 'disburse', 'settle', 'claim', 'refund'])('never simulates a successful %s operation', async operation => {
    await expect(executePoolOperation(operation)).rejects.toThrow('unavailable');
  });
  it('never invents CredLayer reputation data', () => {
    expect(getReputationSignal()).toBeNull();
  });
  it('blocks confidential document intake before secure processing exists', () => {
    expect(platformCapabilities.documentIntake).toBe(false);
  });
});
import { describe, expect, it } from 'vitest';
import { executePoolOperation, getReputationSignal, platformCapabilities, SOLANA_NETWORK, type PoolOperation } from '@/lib/platform-capabilities';

describe('Financial integration boundaries', () => {
  it('uses Solana Devnet for the initial environment', () => {
    expect(SOLANA_NETWORK).toBe('devnet');
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
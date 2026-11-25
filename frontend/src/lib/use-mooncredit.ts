import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import type { Mooncreditfi } from "@/idl/mooncreditfi";
import {
  CONFIG_SEED,
  moonCreditIdl,
  moonCreditProgramId,
  moonCreditUsdcMint,
  SETTLEMENT_SEED,
} from "@/lib/mooncredit-program";

const readOnlyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("Connect a wallet to submit a transaction.");
  },
  signAllTransactions: async () => {
    throw new Error("Connect a wallet to submit a transaction.");
  },
};

export const moonCreditQueryKeys = {
  all: ["mooncreditfi"] as const,
  pools: ["mooncreditfi", "pools"] as const,
  proposals: (wallet: PublicKey | null) =>
    ["mooncreditfi", "proposals", wallet?.toBase58() ?? null] as const,
  positions: (wallet: PublicKey | null) =>
    ["mooncreditfi", "positions", wallet?.toBase58() ?? null] as const,
  config: ["mooncreditfi", "config"] as const,
  adminProposals: (authority: PublicKey | null) =>
    ["mooncreditfi", "admin", "proposals", authority?.toBase58() ?? null] as const,
  adminSettlements: ["mooncreditfi", "admin", "settlements"] as const,
};

export function useProgram(): Program<Mooncreditfi> {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const provider = useMemo(
    () =>
      new AnchorProvider(connection, anchorWallet ?? readOnlyWallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }),
    [anchorWallet, connection],
  );
  return useMemo(() => new Program<Mooncreditfi>(moonCreditIdl, provider), [provider]);
}

export function usePools() {
  const program = useProgram();
  return useQuery({
    queryKey: moonCreditQueryKeys.pools,
    queryFn: () => program.account.mudarabahPool.all(),
    refetchInterval: 15_000,
  });
}

export function useProposals() {
  const program = useProgram();
  const { publicKey } = useWallet();
  return useQuery({
    queryKey: moonCreditQueryKeys.proposals(publicKey),
    enabled: publicKey !== null,
    queryFn: () => {
      if (!publicKey) return Promise.resolve([]);
      return program.account.businessProposal.all([
        { memcmp: { offset: 8, bytes: publicKey.toBase58() } },
      ]);
    },
    refetchInterval: 15_000,
  });
}

export function usePositions(wallet: PublicKey | null) {
  const program = useProgram();
  return useQuery({
    queryKey: moonCreditQueryKeys.positions(wallet),
    enabled: wallet !== null,
    queryFn: () => {
      if (!wallet) return Promise.resolve([]);
      return program.account.investorPosition.all([
        { memcmp: { offset: 8 + 32, bytes: wallet.toBase58() } },
      ]);
    },
    refetchInterval: 15_000,
  });
}

export function useConfig() {
  const program = useProgram();
  const { connection } = useConnection();
  return useQuery({
    queryKey: moonCreditQueryKeys.config,
    queryFn: async () => {
      const configAddress = PublicKey.findProgramAddressSync([CONFIG_SEED], moonCreditProgramId)[0];
      const config = await program.account.platformConfig.fetchNullable(configAddress);
      if (!config) throw new Error("MoonCreditFi is not initialized on Devnet.");
      if (!config.usdcMint.equals(moonCreditUsdcMint)) {
        throw new Error(
          "The deployed program's USDC mint does not match the configured Devnet mint.",
        );
      }
      const mintInfo = await getMint(connection, moonCreditUsdcMint, "confirmed");
      if (mintInfo.decimals !== 6) {
        throw new Error("The configured Devnet USDC mint must use six decimal places.");
      }
      return config;
    },
    refetchInterval: 15_000,
  });
}

export function useAdminProposals(authority: PublicKey | null) {
  const program = useProgram();
  return useQuery({
    queryKey: moonCreditQueryKeys.adminProposals(authority),
    enabled: authority !== null,
    queryFn: async () => {
      if (!authority) return [];
      const [proposals, rejections] = await Promise.all([
        program.account.businessProposal.all([
          { memcmp: { offset: 8 + 32 + 32 + 8 + 2, bytes: "1" } },
        ]),
        program.account.proposalRejection.all([
          { memcmp: { offset: 8 + 32, bytes: authority.toBase58() } },
        ]),
      ]);
      const rejectedProposals = new Set(
        rejections.map(({ account }) => account.proposal.toBase58()),
      );
      return proposals.filter(
        ({ publicKey, account }) =>
          !account.approved && !rejectedProposals.has(publicKey.toBase58()),
      );
    },
    refetchInterval: 15_000,
  });
}

export function useAdminSettlements(enabled = true) {
  const program = useProgram();
  const { connection } = useConnection();
  return useQuery({
    queryKey: moonCreditQueryKeys.adminSettlements,
    enabled,
    queryFn: async () => {
      const pools = await program.account.mudarabahPool.all([
        { memcmp: { offset: 8 + 32 * 4 + 8 * 3 + 2, bytes: "4" } },
      ]);
      return Promise.all(
        pools.map(async (pool) => {
          const settlementAddress = PublicKey.findProgramAddressSync(
            [SETTLEMENT_SEED, pool.publicKey.toBuffer()],
            moonCreditProgramId,
          )[0];
          const [settlement, vaultBalance] = await Promise.all([
            program.account.settlementRecord.fetchNullable(settlementAddress),
            connection.getTokenAccountBalance(pool.account.vault, "confirmed"),
          ]);
          if (!settlement) {
            throw new Error(`Settlement record is missing for pool ${pool.publicKey.toBase58()}.`);
          }
          return {
            pool,
            settlementAddress,
            settlement,
            vaultBalance: new BN(vaultBalance.value.amount),
          };
        }),
      );
    },
    refetchInterval: 15_000,
  });
}

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

export function WalletProviderClient({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint="https://api.devnet.solana.com">
      <AdapterWalletProvider wallets={wallets} autoConnect={false}>
        <WalletSessionMonitor />
        {children}
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}

function WalletSessionMonitor() {
  const { publicKey } = useWallet();
  const lastAddress = useRef<string | null>(null);

  useEffect(() => {
    const address = publicKey?.toBase58() ?? null;
    const previous = lastAddress.current;
    lastAddress.current = address;
    if (previous && previous !== address) {
      void supabase.auth.signOut().then(({ error }) => {
        if (error) console.error("Could not clear the previous wallet session.", error);
      });
    }
  }, [publicKey]);

  return null;
}

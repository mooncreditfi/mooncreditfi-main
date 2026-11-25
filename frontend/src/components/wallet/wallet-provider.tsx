import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { WalletRuntimeContext } from "./wallet-runtime-context";
const loadWalletProvider = createClientOnlyFn(async () => {
  await import("@/lib/solana-buffer");
  return import("./wallet-provider.client");
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [ClientProvider, setClientProvider] = useState<ComponentType<{
    children: ReactNode;
  }> | null>(null);

  useEffect(() => {
    let active = true;
    void loadWalletProvider()
      .then((module) => {
        if (active) setClientProvider(() => module.WalletProviderClient);
      })
      .catch((error) => console.error("Could not load Solana wallet support.", error));
    return () => {
      active = false;
    };
  }, []);

  if (!ClientProvider) {
    return <WalletRuntimeContext.Provider value={false}>{children}</WalletRuntimeContext.Provider>;
  }
  return (
    <WalletRuntimeContext.Provider value>
      <ClientProvider>{children}</ClientProvider>
    </WalletRuntimeContext.Provider>
  );
}

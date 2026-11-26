import { useEffect, useState, type ComponentType } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useWalletRuntimeReady } from "./wallet-runtime-context";

const loadWalletConnect = createClientOnlyFn(() => import("./wallet-connect.client"));

type WalletConnectButtonProps = { requireAuthentication?: boolean; showBalance?: boolean };
export function WalletConnectButton({ requireAuthentication = true, showBalance = false }: WalletConnectButtonProps) {
  const ready = useWalletRuntimeReady();
  const { user, loading } = useAuth();
  const [ClientButton, setClientButton] = useState<ComponentType<WalletConnectButtonProps & { authenticated: boolean }> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void loadWalletConnect().then((module) => {
      if (active) setClientButton(() => module.WalletConnectButtonClient);
    }).catch((error) => {
      console.error("Could not load the wallet connection controls.", error);
      if (active) setLoadFailed(true);
    });
    return () => { active = false; };
  }, [ready]);

  if (ClientButton) return <ClientButton authenticated={Boolean(user)} requireAuthentication={requireAuthentication} showBalance={showBalance}/>;
  return <Button type="button" variant="gold" disabled className="wallet-mobile-trigger">
    {loadFailed ? <Wallet/> : <Loader2 className="animate-spin"/>}
    <span className="wallet-trigger-label">{loadFailed ? "Wallet unavailable" : loading ? "Restoring session…" : "Loading wallet…"}</span>
  </Button>;
}

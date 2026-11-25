import { useEffect, useState, type ComponentType } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletRuntimeReady } from "./wallet-runtime-context";

const loadWalletConnect = createClientOnlyFn(() => import("./wallet-connect.client"));

type WalletConnectButtonProps = {
  requireAuthentication?: boolean;
  showBalance?: boolean;
  compact?: boolean;
};

export function WalletConnectButton({
  requireAuthentication = true,
  showBalance = false,
  compact = false,
}: WalletConnectButtonProps) {
  const ready = useWalletRuntimeReady();
  const [ClientButton, setClientButton] = useState<ComponentType<WalletConnectButtonProps> | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void loadWalletConnect()
      .then((module) => {
        if (active) setClientButton(() => module.WalletConnectButtonClient);
      })
      .catch((error) => {
        console.error("Could not load the wallet connection controls.", error);
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [ready]);

  if (ClientButton)
    return (
      <ClientButton
        requireAuthentication={requireAuthentication}
        showBalance={showBalance}
        compact={compact}
      />
    );
  return (
    <Button type="button" variant="gold" disabled>
      {loadFailed ? <Wallet /> : <Loader2 className="animate-spin" />}
      {loadFailed ? "Wallet unavailable" : "Loading wallet…"}
    </Button>
  );
}

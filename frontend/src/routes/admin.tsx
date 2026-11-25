import { createFileRoute } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, useState, type ComponentType } from "react";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { useWalletRuntimeReady } from "@/components/wallet/wallet-runtime-context";

const loadClientAdmin = createClientOnlyFn(async () => {
  await import("@/lib/solana-buffer");
  return import("@/components/admin-content.client");
});

function AdminRouteComponent() {
  const [ClientAdmin, setClientAdmin] = useState<ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const walletRuntimeReady = useWalletRuntimeReady();

  useEffect(() => {
    if (!walletRuntimeReady) return;
    let active = true;
    void loadClientAdmin()
      .then((module) => {
        if (active) setClientAdmin(() => module.AdminContentClient);
      })
      .catch((error: unknown) => {
        console.error("Could not load admin operations.", error);
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "The admin interface could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [walletRuntimeReady]);

  if (ClientAdmin) return <ClientAdmin />;
  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="PLATFORM ADMIN"
        title={loadError ? "Could not load admin operations" : "Connecting to Solana Devnet"}
        description={
          loadError ??
          "Verifying the connected wallet against the on-chain platform authority."
        }
      />
    </Workspace>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminRouteComponent,
});

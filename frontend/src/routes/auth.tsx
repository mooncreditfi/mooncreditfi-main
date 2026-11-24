import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, LockKeyhole } from "lucide-react";
import { WalletConnectButton } from "@/components/wallet/wallet-connect";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";

export const Route = createFileRoute("/auth")({
  head: () => pageMetadata("Wallet Access", "Connect a Solana wallet to access MoonCreditFi."),
  component: WalletAccess,
});

function WalletAccess() {
  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="TRUST BEFORE CAPITAL"
        title="Wallet access"
        description="Connect a wallet, then authenticate through Supabase."
      />
      <div className="workspace-empty">
        <div className="icon-tile">
          <LockKeyhole />
        </div>
        <h2>Sign in with Solana</h2>
        <p>MoonCreditFi uses a Supabase-verified sign-in message, never a transaction signature.</p>
        <WalletConnectButton />
      </div>
      <p className="risk-note">
        <CircleAlert />
        Wallet connection uses {SOLANA_NETWORK} for app transactions. Supabase Web3 authentication
        is configured separately and must be enabled for this project.
      </p>
    </Workspace>
  );
}

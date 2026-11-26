import { createFileRoute, redirect } from "@tanstack/react-router";
import { CircleAlert, LockKeyhole } from "lucide-react";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";
import { pageMetadata } from "@/lib/page-metadata";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";

export const Route = createFileRoute("/auth")({
  head: () => pageMetadata("Wallet Access", "Connect a Solana wallet to access MoonCreditFi."),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const profile = getMoonCreditProfile(data.user);
    if (!profile) throw redirect({ to: "/onboarding" });
    if (profile.roles.includes("entrepreneur")) {
      throw redirect({ to: "/entrepreneur", search: { view: "overview" } });
    }
    if (profile.roles.includes("investor")) {
      throw redirect({ to: "/dashboard", search: { view: "overview" } });
    }
    throw redirect({ to: "/onboarding" });
  },
  component: WalletAccess,
});

function WalletAccess() {
  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="TRUST BEFORE CAPITAL"
        title="Wallet access"
        description="One verified wallet sign-in applies to every role enabled on your profile."
      />
      <div className="workspace-empty workspace-auth-card">
        <div className="icon-tile">
          <LockKeyhole />
        </div>
        <h2>Sign in with Solana</h2>
        <p>
          Sign in once with your wallet to access all workspaces enabled on your profile. This
          signature verifies your identity; it does not authorize a blockchain transaction.
        </p>
        <p>Use the wallet control in the page header to connect and sign in.</p>
      </div>
      <p className="risk-note">
        <CircleAlert />
        Wallet connection uses {SOLANA_NETWORK} for app transactions. Supabase Web3 authentication
        is configured separately and must be enabled for this project.
      </p>
    </Workspace>
  );
}

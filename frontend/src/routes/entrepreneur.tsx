import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { DashboardContent, validateWorkspaceSearch } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";
import { useWalletRuntimeReady } from "@/components/wallet/wallet-runtime-context";

const loadFeature = createClientOnlyFn(() => import("@/components/workspace-feature.client"));
export const Route = createFileRoute("/entrepreneur")({
  validateSearch: validateWorkspaceSearch,
  head: () => pageMetadata("Entrepreneur Dashboard", "Manage business profiles, funding proposals and on-chain activity."),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const profile = getMoonCreditProfile(data.user);
    if (!profile) throw redirect({ to: "/onboarding" });
    if (!profile.roles.includes("entrepreneur")) throw redirect({ to: "/dashboard", search: { view: "overview" } });
  },
  component: EntrepreneurDashboard,
});
function EntrepreneurDashboard() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const ready = useWalletRuntimeReady();
  const [Feature, setFeature] = useState<ComponentType<{ view: string; entrepreneur: boolean }> | null>(null);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void loadFeature().then((module) => { if (active) setFeature(() => module.WorkspaceFeatureContent); }).catch(console.error);
    return () => { active = false; };
  }, [ready]);
  const selected = view ?? "overview";
  if (["my-businesses", "business-documents", "funding-proposals", "business-reports", "transactions", "notifications", "settings"].includes(selected) && Feature)
    return <Feature view={selected} entrepreneur/>;
  return <DashboardContent entrepreneur view={selected} onViewChange={(next) => { void navigate({ search: { view: next } }); }}/>;
}

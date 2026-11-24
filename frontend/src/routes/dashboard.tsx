import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardContent, validateWorkspaceSearch } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
import { supabase } from "@/integrations/supabase/client";
import { getMoonCreditProfile } from "@/lib/account-profile";

export const Route = createFileRoute("/dashboard")({
  validateSearch: validateWorkspaceSearch,
  head: () =>
    pageMetadata(
      "Investor Dashboard",
      "MoonCreditFi investor workspace for investment positions, transactions and account settings. Account access is pending activation.",
    ),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const profile = getMoonCreditProfile(data.user);
    if (!profile) throw redirect({ to: "/onboarding" });
    if (!profile.roles.includes("investor"))
      throw redirect({ to: "/entrepreneur", search: { view: "overview" } });
  },
  component: InvestorDashboard,
});
function InvestorDashboard() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DashboardContent
      entrepreneur={false}
      view={view ?? "overview"}
      onViewChange={(next) => {
        void navigate({ search: { view: next } });
      }}
    />
  );
}

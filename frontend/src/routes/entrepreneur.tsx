import { createFileRoute, redirect } from '@tanstack/react-router';
import { DashboardContent, validateWorkspaceSearch } from '@/components/workspace';
import { pageMetadata } from '@/lib/page-metadata';
import { supabase } from '@/integrations/supabase/client';
import { getMoonCreditProfile } from '@/lib/account-profile';
export const Route = createFileRoute('/entrepreneur')({
  validateSearch: validateWorkspaceSearch,
  head: () => pageMetadata('Entrepreneur Dashboard', 'MoonCreditFi entrepreneur workspace for businesses, private documents, funding proposals and business reports. Account access is pending activation.'),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: '/auth' });
    const profile = getMoonCreditProfile(data.user);
    if (!profile) throw redirect({ to: '/onboarding' });
    if (!profile.roles.includes('entrepreneur')) throw redirect({ to: '/dashboard', search: { view: 'overview' } });
  },
  component: EntrepreneurDashboard,
});
function EntrepreneurDashboard() {
  const { view } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <DashboardContent entrepreneur view={view ?? 'overview'} onViewChange={next => { void navigate({ search: { view: next } }); }}/>;
}
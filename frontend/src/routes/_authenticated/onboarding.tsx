import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Workspace, WorkspaceTitle } from '@/components/workspace';
import { pageMetadata } from '@/lib/page-metadata';
import { saveMoonCreditProfile, type MoonCreditRole } from '@/lib/account-profile';

export const Route = createFileRoute('/_authenticated/onboarding')({
  head: () => pageMetadata('Complete your profile', 'Create a MoonCreditFi profile and choose your role.'),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<MoonCreditRole[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleRole(role: MoonCreditRole) {
    setRoles(current => current.includes(role) ? current.filter(item => item !== role) : [...current, role]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roles.length === 0) {
      toast.error('Select at least one role.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const profile = {
      full_name: String(form.get('full_name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      country: String(form.get('country') ?? '').trim(),
      city: String(form.get('city') ?? '').trim(),
      profile_image: String(form.get('profile_image') ?? '').trim() || undefined,
      roles,
    };
    setBusy(true);
    try {
      await saveMoonCreditProfile(profile);
      toast.success('Profile saved.');
      void navigate({ to: roles.includes('entrepreneur') ? '/entrepreneur' : '/dashboard', search: { view: 'overview' } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Your profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return <Workspace>
    <WorkspaceTitle eyebrow="PROFILE SETUP" title="Complete your MoonCreditFi profile" description="This information identifies your application. You can add the other role later."/>
    <form className="onboarding-layout" onSubmit={submit}>
      <section className="onboarding-card">
        <h2>Personal information</h2>
        <div className="onboarding-fields">
          <label><span>Full name <b>Required</b></span><input name="full_name" required maxLength={120} autoComplete="name"/></label>
          <label><span>Email address <b>Required</b></span><input name="email" type="email" required maxLength={254} autoComplete="email"/></label>
          <label><span>Phone number <b>Required</b></span><input name="phone" type="tel" required maxLength={40} autoComplete="tel"/></label>
          <label><span>Country <b>Required</b></span><input name="country" required maxLength={80} autoComplete="country-name"/></label>
          <label><span>City <b>Required</b></span><input name="city" required maxLength={80} autoComplete="address-level2"/></label>
          <label><span>Profile image URL <b>Optional</b></span><input name="profile_image" type="url" maxLength={2048} placeholder="https://..."/></label>
        </div>
      </section>
      <section className="onboarding-card">
        <h2>Choose your role</h2>
        <p className="onboarding-help">You may select both roles. Reviewer privileges are never self-assigned.</p>
        <div className="role-options">
          <button type="button" className={roles.includes('entrepreneur') ? 'role-option selected' : 'role-option'} aria-pressed={roles.includes('entrepreneur')} onClick={() => toggleRole('entrepreneur')}>
            <ShieldCheck/><strong>Entrepreneur</strong><span>Register businesses and seek financing.</span>
          </button>
          <button type="button" className={roles.includes('investor') ? 'role-option selected' : 'role-option'} aria-pressed={roles.includes('investor')} onClick={() => toggleRole('investor')}>
            <ShieldCheck/><strong>Investor</strong><span>Discover opportunities and contribute USDC.</span>
          </button>
        </div>
        <Button variant="gold" type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin"/>}{busy ? 'Saving profile…' : 'Save and continue'}</Button>
      </section>
    </form>
  </Workspace>;
}

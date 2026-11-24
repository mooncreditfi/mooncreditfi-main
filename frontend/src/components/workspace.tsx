import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useWalletRuntimeReady } from "@/components/wallet/wallet-runtime-context";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  CircleAlert,
  FileCheck2,
  Handshake,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMoonCreditProfile,
  saveMoonCreditProfile,
  type MoonCreditProfile,
  type MoonCreditRole,
} from "@/lib/account-profile";

const loadClientPools = createClientOnlyFn(async () => {
  await import("@/lib/solana-buffer");
  return import("./pools-content.client");
});

export function Workspace({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [roles, setRoles] = useState<MoonCreditRole[]>([]);
  const location = useLocation();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const profile = getMoonCreditProfile(session?.user ?? null);
      setSignedIn(Boolean(session?.user));
      setRoles(profile?.roles ?? []);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    window.location.assign("/auth");
  }
  return (
    <div className="workspace">
      <aside className={`workspace-sidebar ${open ? "is-open" : ""}`}>
        <Link to="/" className="brand workspace-brand">
          <img src="/favicon.png" alt="" width="34" height="34" />
          <span>
            MoonCredit<em>Fi</em>
          </span>
        </Link>
        <p className="workspace-nav-label">WORKSPACE</p>
        <nav aria-label="Application navigation" onClick={() => setOpen(false)}>
          {roles.includes("investor") && (
            <Link
              to="/dashboard"
              search={{ view: "overview" }}
              className={location.pathname === "/dashboard" ? "selected" : ""}
            >
              <LayoutDashboard />
              Investor
            </Link>
          )}
          {roles.includes("entrepreneur") && (
            <Link
              to="/entrepreneur"
              search={{ view: "overview" }}
              className={location.pathname === "/entrepreneur" ? "selected" : ""}
            >
              <Building2 />
              Entrepreneur
            </Link>
          )}
          {!signedIn && (
            <>
              <Link
                to="/dashboard"
                search={{ view: "overview" }}
                className={location.pathname === "/dashboard" ? "selected" : ""}
              >
                <LayoutDashboard />
                Investor
              </Link>
              <Link
                to="/entrepreneur"
                search={{ view: "overview" }}
                className={location.pathname === "/entrepreneur" ? "selected" : ""}
              >
                <Building2 />
                Entrepreneur
              </Link>
            </>
          )}
          <Link to="/readiness" className={location.pathname === "/readiness" ? "selected" : ""}>
            <FileCheck2 />
            Readiness
          </Link>
          <Link
            to="/opportunities"
            className={location.pathname === "/opportunities" ? "selected" : ""}
          >
            <Search />
            Opportunities
          </Link>
          <Link to="/pools" className={location.pathname === "/pools" ? "selected" : ""}>
            <Handshake />
            Pools
          </Link>
        </nav>
        <div className="workspace-sidebar-bottom">
          <ShieldCheck />
          <strong>Trust Before Capital.</strong>
          <p>
            Returns are not guaranteed.
            <br />
            Capital is at risk.
          </p>
          <Link to="/">
            Back to MoonCreditFi <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      {open && (
        <Button
          variant="ghost"
          className="workspace-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="flex items-center gap-3">
            <Button
              className="workspace-menu"
              variant="ghost"
              size="icon"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              onClick={() => setOpen((s) => !s)}
            >
              {open ? <X /> : <Menu />}
            </Button>
            <span className="network-badge">
              <span />
              Solana Devnet
            </span>
            {roles.length > 1 && (
              <div className="workspace-role-switcher" aria-label="Role switcher">
                {roles.map((role) =>
                  role === "entrepreneur" ? (
                    <Link
                      key={role}
                      to="/entrepreneur"
                      search={{ view: "overview" }}
                      className={location.pathname === "/entrepreneur" ? "selected" : ""}
                    >
                      Entrepreneur
                    </Link>
                  ) : (
                    <Link
                      key={role}
                      to="/dashboard"
                      search={{ view: "overview" }}
                      className={location.pathname === "/dashboard" ? "selected" : ""}
                    >
                      Investor
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
          {signedIn ? (
            <Button variant="wallet" onClick={() => void signOut()}>
              <LogOut />
              Sign out
            </Button>
          ) : (
            <Button asChild variant="wallet">
              <Link to="/auth">
                <Wallet />
                Sign in
              </Link>
            </Button>
          )}
        </header>
        <div className="workspace-network-note">
          <CircleAlert size={14} />
          <span>Devnet only · Tokens have no real value.</span>
        </div>
        <main className="workspace-main">{children}</main>
        <footer className="workspace-footer">
          MoonCreditFi · Ethical finance. Earned trust.
          <span>Pool transactions are wallet-confirmed and Devnet-only.</span>
        </footer>
      </div>
    </div>
  );
}

export function WorkspaceTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="workspace-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AccountGate({
  title = "Records unavailable",
  description = "Required data integrations are not configured yet.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="workspace-empty">
      <div className="icon-tile">
        <LockKeyhole />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Button asChild variant="gold">
        <Link to="/auth">
          Account access
          <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

const investorViews = [
  "Overview",
  "Profile",
  "My Investments",
  "Transactions",
  "Notifications",
  "Settings",
];
const entrepreneurViews = [
  "Overview",
  "Profile",
  "My Businesses",
  "Business Documents",
  "Funding Proposals",
  "Business Reports",
  "Notifications",
  "Settings",
];
export const viewKey = (label: string) => label.toLowerCase().replaceAll(" ", "-");
export function validateWorkspaceSearch(search: Record<string, unknown>): { view?: string } {
  const allowed = [...investorViews, ...entrepreneurViews].map(viewKey);
  return typeof search["view"] === "string" && allowed.includes(search["view"])
    ? { view: search["view"] }
    : {};
}

function AccountProfileView() {
  const [profile, setProfile] = useState<MoonCreditProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setProfile(getMoonCreditProfile(data.user));
    });
  }, []);

  function toggleRole(role: MoonCreditRole) {
    setProfile((current) =>
      current
        ? {
            ...current,
            roles: current.roles.includes(role)
              ? current.roles.filter((item) => item !== role)
              : [...current.roles, role],
          }
        : current,
    );
  }

  if (!profile)
    return (
      <AccountGate
        title="Complete your profile"
        description="Sign in and complete onboarding before role and profile settings can be loaded."
      />
    );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfile = profile;
    if (!currentProfile) return;
    if (currentProfile.roles.length === 0) {
      toast.error("Keep at least one role enabled.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const next: MoonCreditProfile = {
      ...currentProfile,
      full_name: String(form.get("full_name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      country: String(form.get("country") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      profile_image: String(form.get("profile_image") ?? "").trim() || undefined,
      roles: currentProfile.roles,
    };
    if (!next.full_name || !next.email || !next.phone || !next.country || !next.city) {
      toast.error("Complete all required profile fields.");
      return;
    }
    setBusy(true);
    try {
      await saveMoonCreditProfile(next);
      setProfile(next);
      toast.success("Profile and roles saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="onboarding-layout" onSubmit={save}>
      <section className="onboarding-card">
        <h2>Profile details</h2>
        <div className="onboarding-fields">
          <label>
            <span>
              Full name <b>Required</b>
            </span>
            <input name="full_name" required defaultValue={profile.full_name} />
          </label>
          <label>
            <span>
              Email address <b>Required</b>
            </span>
            <input name="email" type="email" required defaultValue={profile.email} />
          </label>
          <label>
            <span>
              Phone number <b>Required</b>
            </span>
            <input name="phone" type="tel" required defaultValue={profile.phone} />
          </label>
          <label>
            <span>
              Country <b>Required</b>
            </span>
            <input name="country" required defaultValue={profile.country} />
          </label>
          <label>
            <span>
              City <b>Required</b>
            </span>
            <input name="city" required defaultValue={profile.city} />
          </label>
          <label>
            <span>
              Profile image URL <b>Optional</b>
            </span>
            <input name="profile_image" type="url" defaultValue={profile.profile_image ?? ""} />
          </label>
        </div>
      </section>
      <section className="onboarding-card">
        <h2>Your roles</h2>
        <div className="role-options">
          {(["entrepreneur", "investor"] as MoonCreditRole[]).map((role) => (
            <button
              key={role}
              type="button"
              className={profile.roles.includes(role) ? "role-option selected" : "role-option"}
              aria-pressed={profile.roles.includes(role)}
              onClick={() => toggleRole(role)}
            >
              <ShieldCheck />
              <strong>{role === "entrepreneur" ? "Entrepreneur" : "Investor"}</strong>
              <span>
                {role === "entrepreneur"
                  ? "Register businesses and seek financing."
                  : "Discover opportunities and contribute USDC."}
              </span>
            </button>
          ))}
        </div>
        <Button variant="gold" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save profile and roles"}
        </Button>
      </section>
    </form>
  );
}

export function DashboardContent({
  entrepreneur,
  view,
  onViewChange,
}: {
  entrepreneur: boolean;
  view: string;
  onViewChange: (view: string) => void;
}) {
  const views = entrepreneur ? entrepreneurViews : investorViews;
  const current = views.find((item) => viewKey(item) === view) ?? "Overview";
  const metrics = entrepreneur
    ? ["Business verification", "Submitted proposals", "Active funding pools", "Capital received"]
    : ["Contributed capital", "Active investments", "Completed investments", "Pending claims"];
  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow={entrepreneur ? "ENTREPRENEUR" : "INVESTOR"}
        title={
          current === "Overview"
            ? entrepreneur
              ? "Business overview"
              : "Portfolio overview"
            : current
        }
        description={
          entrepreneur ? "Businesses, proposals and reports." : "Investments and transactions."
        }
      />
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label={entrepreneur ? "Entrepreneur views" : "Investor views"}
      >
        {views.map((item) => (
          <Button
            key={item}
            role="tab"
            aria-selected={item === current}
            variant="nav"
            className={item === current ? "selected" : ""}
            onClick={() => onViewChange(viewKey(item))}
          >
            {item}
          </Button>
        ))}
      </div>
      {current === "Overview" ? (
        <>
          <div className="workspace-metrics">
            {metrics.map((label, i) => (
              <article key={label}>
                <span>{label}</span>
                {i === 0 ? <Wallet /> : <ChartNoAxesCombined />}
                <strong>—</strong>
                <small>No live records</small>
              </article>
            ))}
          </div>
          <div className="workspace-section-heading">
            <h2>{entrepreneur ? "Business activity" : "Portfolio activity"}</h2>
            <span>Private data</span>
          </div>
          <AccountGate />
          <div className="workspace-paths">
            <Link to="/opportunities">
              <div className="icon-tile">
                <Search />
              </div>
              <div>
                <h3>Opportunities</h3>
                <p>Business profiles and terms.</p>
              </div>
              <ArrowUpRight />
            </Link>
            <Link to="/pools">
              <div className="icon-tile">
                <Handshake />
              </div>
              <div>
                <h3>Pools</h3>
                <p>Profit sharing and risk.</p>
              </div>
              <ArrowUpRight />
            </Link>
          </div>
        </>
      ) : current === "Profile" || current === "Settings" ? (
        <AccountProfileView />
      ) : current === "Business Documents" ? (
        <AccountGate
          title="Document upload unavailable"
          description="Secure storage is not configured."
        />
      ) : (
        <AccountGate
          title={`${current} unavailable`}
          description="Required backend or blockchain integrations are not configured. No data is fabricated."
        />
      )}
      <p className="risk-note">
        <CircleAlert />
        Mudarabah returns are not guaranteed. You may lose capital; verification and reputation do
        not guarantee repayment.
      </p>
    </Workspace>
  );
}

export function OpportunitiesContent() {
  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="INVESTOR"
        title="Opportunities"
        description="Browse approved business funding."
      />
      <div className="workspace-section-heading">
        <h2>Open listings</h2>
        <span>Unavailable</span>
      </div>
      <div className="workspace-empty">
        <div className="icon-tile">
          <Building2 />
        </div>
        <h2>No open opportunities</h2>
        <p>Approved listings are not available. Investments are disabled.</p>
        <Button asChild variant="quiet">
          <Link to="/entrepreneur" search={{ view: "my-businesses" }}>
            Entrepreneur view
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="workspace-principles">
        <div>
          <FileCheck2 />
          <h3>Verified businesses</h3>
          <p>Identity and business checks differ.</p>
        </div>
        <div>
          <Handshake />
          <h3>Shared profit</h3>
          <p>Review each pool’s terms.</p>
        </div>
        <div>
          <ShieldCheck />
          <h3>Investment risk</h3>
          <p>Returns are not guaranteed.</p>
        </div>
      </div>
    </Workspace>
  );
}

export function PoolsContent() {
  const [ClientPools, setClientPools] = useState<ComponentType | null>(null);
  const walletRuntimeReady = useWalletRuntimeReady();

  useEffect(() => {
    if (!walletRuntimeReady) return;
    let active = true;
    void loadClientPools()
      .then((module) => {
        if (active) setClientPools(() => module.PoolsContentClient);
      })
      .catch((error) => console.error("Could not load pool operations.", error));
    return () => {
      active = false;
    };
  }, [walletRuntimeReady]);

  if (ClientPools) return <ClientPools />;
  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="PROFIT SHARING"
        title="Mudarabah pools"
        description="Loading live Solana Devnet pool data."
      />
      <div className="workspace-empty" aria-live="polite">
        <div className="icon-tile">
          <Handshake />
        </div>
        <h2>Connecting to Solana Devnet</h2>
        <p>Pool and proposal records are loaded directly from the MoonCreditFi program.</p>
      </div>
    </Workspace>
  );
}

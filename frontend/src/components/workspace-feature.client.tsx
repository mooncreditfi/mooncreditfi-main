import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { usePools, usePositions } from "@/lib/use-mooncredit";
import { calculateInvestorPayout } from "@/lib/payouts";
import { SOLANA_NETWORK } from "@/lib/platform-capabilities";
import type { Tables } from "@/integrations/supabase/types";

const explorer = (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
function statusName(value: string | Record<string, unknown>) {
  return typeof value === "string" ? value.toLowerCase() : (Object.keys(value)[0]?.toLowerCase() ?? "unknown");
}
function usdc(value: BN) {
  const whole = value.div(new BN(1_000_000)).toString();
  const fraction = value.mod(new BN(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function WorkspaceFeatureContent({ view, entrepreneur }: { view: string; entrepreneur: boolean }) {
  const wallet = useWallet();
  const user = useAuth().user;
  const poolsQuery = usePools();
  const positionsQuery = usePositions(wallet.publicKey);
  const pools = poolsQuery.data ?? [];
  const positions = positionsQuery.data ?? [];
  const [transactions, setTransactions] = useState<Tables<"indexed_transactions">[]>([]);
  const [notifications, setNotifications] = useState<Tables<"notifications">[]>([]);
  const [businesses, setBusinesses] = useState<Tables<"businesses">[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState("");

  async function loadRecords() {
    if (!user) return;
    setLoading(true);
    setQueryError("");
    try {
      if (view === "transactions" && wallet.publicKey) {
        const { data, error } = await supabase.from("indexed_transactions")
          .select("*").eq("wallet_address", wallet.publicKey.toBase58())
          .in("transaction_status", ["confirmed", "finalized"])
          .order("block_time", { ascending: false }).limit(100);
        if (error) throw error;
        setTransactions(data ?? []);
      } else if (view === "notifications") {
        const { data, error } = await supabase.from("notifications")
          .select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        setNotifications(data ?? []);
      } else if (view === "my-businesses" && entrepreneur) {
        const { data, error } = await supabase.from("businesses")
          .select("*").eq("owner_user_id", user.id).order("updated_at", { ascending: false });
        if (error) throw error;
        setBusinesses(data ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load records.";
      setQueryError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRecords(); }, [user?.id, view, wallet.publicKey?.toBase58()]);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const country = String(form.get("country") ?? "").trim();
    if (!name) return;
    setLoading(true);
    const { error } = await supabase.from("businesses").insert({
      owner_user_id: user.id, name, description, category: category || null,
      city: city || null, country: country || null,
    });
    setLoading(false);
    if (error) { toast.error(`Could not save business: ${error.message}`); return; }
    event.currentTarget.reset();
    toast.success("Business profile saved.");
    await loadRecords();
  }

  async function markRead(id: string | null) {
    if (!id) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await loadRecords();
  }

  async function markAllRead() {
    if (!user) return;
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id).is("read_at", null);
    if (error) { toast.error(error.message); return; }
    await loadRecords();
  }

  const title = view === "my-investments" ? "My investments" : view === "transactions" ? "Transaction history" :
    view === "notifications" ? "Notifications" : view === "settings" ? "Settings" :
      view === "my-businesses" ? "My businesses" : view.replaceAll("-", " ");
  const positionsWithPool = useMemo(() => positions.map((position) => ({
    position, pool: pools.find((item) => item.publicKey.equals(position.account.pool)),
  })), [positions, pools]);

  return <Workspace>
    <WorkspaceTitle eyebrow={entrepreneur ? "ENTREPRENEUR WORKSPACE" : "INVESTOR WORKSPACE"}
      title={title} description="Records are retrieved from your connected wallet, Supabase account, or the MoonCreditFi program.">
      <Button variant="quiet" onClick={() => void loadRecords()} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""}/> Refresh</Button>
    </WorkspaceTitle>
    <nav className="workspace-paths" aria-label="Workspace sections">
      <Link to={entrepreneur ? "/entrepreneur" : "/dashboard"} search={{ view: entrepreneur ? "my-businesses" : "my-investments" }}>{entrepreneur ? "My businesses" : "My investments"}</Link>
      <Link to={entrepreneur ? "/entrepreneur" : "/dashboard"} search={{ view: "transactions" }}>Transactions</Link>
      <Link to={entrepreneur ? "/entrepreneur" : "/dashboard"} search={{ view: "notifications" }}>Notifications</Link>
      <Link to={entrepreneur ? "/entrepreneur" : "/dashboard"} search={{ view: "settings" }}>Settings</Link>
    </nav>
    {queryError && <div className="workspace-empty" role="alert"><h2>Records could not be loaded</h2><p>{queryError}</p><p>Confirm the platform migration is applied and RLS is configured, then retry.</p></div>}
    {loading && <p aria-live="polite">Loading account records…</p>}

    {view === "my-investments" && <section className="onboarding-card">
      <h2>On-chain investor positions</h2>
      {!wallet.publicKey ? <p>Connect the wallet used for contributions to load your positions.</p> : positionsQuery.isLoading ? <p>Reading confirmed Solana {SOLANA_NETWORK} program accounts…</p> : positionsWithPool.length === 0 ? <p>No investor positions were found for this wallet.</p> :
        <div className="positions-table-wrap"><table className="positions-table"><thead><tr><th>Pool</th><th>Entrepreneur</th><th>Status</th><th>Contribution</th><th>Claim</th><th>Expected return</th><th>On-chain record</th></tr></thead><tbody>
          {positionsWithPool.map(({ position, pool }) => {
            const status = pool ? statusName(pool.account.status) : "unavailable";
            const expected = pool && status === "settled" ? calculateInvestorPayout(position.account.contributed, pool.account.totalContributed, pool.account.totalReturned, 10_000 - pool.account.entrepreneurProfitBps) : status === "cancelled" ? position.account.contributed : null;
            const poolAddress = position.account.pool.toBase58();
            return <tr key={position.publicKey.toBase58()}><td><Link to="/pools">{short(poolAddress)}</Link></td><td>{pool ? short(pool.account.entrepreneur.toBase58()) : "Unavailable"}</td><td>{status}</td><td>{usdc(position.account.contributed)} USDC</td><td>{position.account.claimed ? "Claimed" : "Unclaimed"}</td><td>{expected ? `${usdc(expected)} USDC` : "Pending settlement"}</td><td><a href={`https://explorer.solana.com/address/${position.publicKey.toBase58()}?cluster=devnet`} target="_blank" rel="noreferrer">Position <ExternalLink size={13}/></a><p className="text-xs">Position account does not store a creation timestamp or contribution signature.</p></td></tr>;
          })}
        </tbody></table></div>}
      <p className="risk-note">Pool and position data is read from confirmed on-chain accounts. Business names and proposal dates are not stored by the deployed program; those fields are not inferred.</p>
    </section>}

    {view === "transactions" && <section className="onboarding-card"><h2>Indexed confirmed transactions</h2>
      {!wallet.publicKey ? <p>Connect your wallet to view activity indexed for its address.</p> : transactions.length === 0 ? <p>No indexed confirmed transactions are available for this wallet. Direct Solana account state remains visible; the event indexer must be deployed to show complete history.</p> :
      <div className="positions-table-wrap"><table className="positions-table"><thead><tr><th>Type</th><th>Amount</th><th>Date</th><th>Status</th><th>Wallet</th><th>Signature</th></tr></thead><tbody>{transactions.map((tx) => <tr key={`${tx.signature}-${tx.event_index}`}><td>{tx.instruction_type}</td><td>{tx.amount_base_units ? `${(Number(tx.amount_base_units) / 1_000_000).toLocaleString()} USDC` : "—"}</td><td>{tx.block_time ? new Date(tx.block_time).toLocaleString() : "—"}</td><td>{tx.transaction_status}</td><td><code>{tx.wallet_address ? short(tx.wallet_address) : "—"}</code></td><td><a href={explorer(tx.signature)} target="_blank" rel="noreferrer">{short(tx.signature)} <ExternalLink size={13}/></a></td></tr>)}</tbody></table></div>}
      <p className="risk-note">History is sourced only from the indexed transaction ledger. A successful wallet transaction is not assumed to be indexed.</p>
    </section>}

    {view === "my-businesses" && entrepreneur && <section className="onboarding-layout"><form className="onboarding-card" onSubmit={(event) => void createBusiness(event)}>
      <h2>Create a business profile</h2><p>Business information is stored as private owner-scoped application data. Verification is not implied.</p>
      <label className="proposal-field"><span>Business name</span><Input name="name" required maxLength={160}/></label>
      <label className="proposal-field"><span>Description</span><textarea name="description" maxLength={5000}/></label>
      <label className="proposal-field"><span>Category</span><Input name="category" maxLength={120}/></label>
      <label className="proposal-field"><span>City</span><Input name="city" maxLength={120}/></label>
      <label className="proposal-field"><span>Country</span><Input name="country" maxLength={120}/></label>
      <Button variant="gold" type="submit" disabled={loading}>Save business</Button>
    </form><div className="onboarding-card"><h2>Your businesses</h2>{businesses.length === 0 ? <p>No saved business profiles were found.</p> : businesses.map((business) => <article className="proposal-record" key={business.id}><h3>{business.name}</h3><p>{business.description || "No description added."}</p><p>{[business.city, business.country].filter(Boolean).join(", ") || "Location not provided"} · {business.category || "Category not provided"}</p><span>Verification: {business.verification_status}</span></article>)}</div></section>}

    {view === "notifications" && <section className="onboarding-card"><div className="workspace-section-heading"><h2>Account notifications</h2><Button variant="quiet" onClick={() => void markAllRead()} disabled={!notifications.some((item) => !item.read_at)}>Mark all read</Button></div>{notifications.length === 0 ? <p>No notifications are available.</p> : notifications.map((item) => <article className="proposal-record" key={item.id}><div className="workspace-section-heading"><h3>{item.title}</h3>{!item.read_at && <Button variant="quiet" onClick={() => void markRead(item.id)}>Mark read</Button>}</div><p>{item.message}</p><small>{new Date(item.created_at ?? "").toLocaleString()} · {item.notification_type}</small></article>)}</section>}

    {view === "settings" && <section className="onboarding-layout"><article className="onboarding-card"><h2>Account and authentication</h2><p>Status: {user ? "Authenticated with Supabase Web3" : "Signed out"}</p><p>Wallet: <code>{wallet.publicKey?.toBase58() ?? "No connected wallet"}</code></p><p>Network: Solana {SOLANA_NETWORK}</p><p>Session tokens, private keys, and recovery phrases are never displayed here.</p><Button variant="gold" onClick={() => void useAuth().signOut().then(() => toast.success("Signed out.")).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not sign out."))}>Sign out</Button></article><NotificationPreference userId={user?.id ?? null}/></section>}

    {!["my-investments", "transactions", "my-businesses", "notifications", "settings"].includes(view) && <div className="workspace-empty"><Wallet/><h2>Feature integration required</h2><p>This section requires the corresponding provisioned backend workflow; no sample records or success states are shown.</p></div>}
  </Workspace>;
}

function NotificationPreference({ userId }: { userId: string | null }) {
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  useEffect(() => {
    if (!userId) return;
    void supabase.from("notification_preferences").select("in_app_enabled").eq("user_id", userId).maybeSingle()
      .then(({ data, error }) => { if (error) setErrorText(error.message); else if (data) setEnabled(data.in_app_enabled); });
  }, [userId]);
  async function savePreference() {
    if (!userId) return;
    setSaving(true); setErrorText("");
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, in_app_enabled: enabled, updated_at: new Date().toISOString() });
    setSaving(false); if (error) setErrorText(error.message); else toast.success("Notification preference saved.");
  }
  return <article className="onboarding-card"><h2>Notification preferences</h2><label className="flex items-center gap-3"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/> In-app notifications enabled</label><Button className="mt-4" variant="quiet" disabled={saving || !userId} onClick={() => void savePreference()}>{saving ? "Saving…" : "Save preference"}</Button>{errorText && <p role="alert">{errorText}</p>}</article>;
}

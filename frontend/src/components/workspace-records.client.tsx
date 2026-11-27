import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, FileText, Plus, UploadCloud } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const DOCUMENT_BUCKET = "mooncredit-business-documents";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const explorer = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  href?: string;
};

function formatAmount(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

export function WorkspaceRecordsContent({
  view,
  entrepreneur,
}: {
  view: string;
  entrepreneur: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const wallet = useWallet();
  const [businesses, setBusinesses] = useState<Tables<"businesses">[]>([]);
  const [proposals, setProposals] = useState<Tables<"funding_proposals">[]>([]);
  const [documents, setDocuments] = useState<Tables<"business_documents">[]>([]);
  const [reports, setReports] = useState<Tables<"business_reports">[]>([]);
  const [transactions, setTransactions] = useState<Tables<"indexed_transactions">[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const currentUserId = userId;
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (entrepreneur) {
          const businessResult = await supabase
            .from("businesses")
            .select("*")
            .eq("owner_user_id", currentUserId)
            .order("updated_at", { ascending: false });
          if (businessResult.error) throw businessResult.error;
          if (!active) return;
          setBusinesses(businessResult.data ?? []);

          if (view === "business-documents" || view === "overview") {
            const result = await supabase
              .from("business_documents")
              .select("*")
              .eq("owner_user_id", currentUserId)
              .order("uploaded_at", { ascending: false })
              .limit(100);
            if (result.error) throw result.error;
            if (active) setDocuments(result.data ?? []);
          }
          if (view === "funding-proposals" || view === "overview") {
            const result = await supabase
              .from("funding_proposals")
              .select("*")
              .eq("owner_user_id", currentUserId)
              .order("updated_at", { ascending: false })
              .limit(100);
            if (result.error) throw result.error;
            if (active) setProposals(result.data ?? []);
          }
          if (view === "business-reports" || view === "overview") {
            const result = await supabase
              .from("business_reports")
              .select("*")
              .eq("owner_user_id", currentUserId)
              .order("period_end", { ascending: false })
              .limit(100);
            if (result.error) throw result.error;
            if (active) setReports(result.data ?? []);
          }
        } else if (view === "overview" && wallet.publicKey) {
          const result = await supabase
            .from("indexed_transactions")
            .select("*")
            .eq("wallet_address", wallet.publicKey.toBase58())
            .in("transaction_status", ["confirmed", "finalized"])
            .order("block_time", { ascending: false })
            .limit(8);
          if (result.error) throw result.error;
          if (active) setTransactions(result.data ?? []);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load workspace data.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [entrepreneur, reloadKey, userId, view, wallet.publicKey]);

  const businessNames = useMemo(
    () => new Map(businesses.map((business) => [business.id, business.name])),
    [businesses],
  );
  const activity = useMemo<ActivityItem[]>(() => {
    if (!entrepreneur) {
      return transactions.map((transaction) => ({
        id: `${transaction.signature}-${transaction.event_index}`,
        title: humanize(transaction.instruction_type),
        detail: `${transaction.transaction_status} · ${transaction.signature.slice(0, 8)}…`,
        timestamp: transaction.block_time ?? transaction.indexed_at,
        href: explorer(transaction.signature),
      }));
    }
    return [
      ...businesses.map((business) => ({
        id: `business-${business.id}`,
        title: "Business profile updated",
        detail: business.name,
        timestamp: business.updated_at,
      })),
      ...proposals.map((proposal) => ({
        id: `proposal-${proposal.id}`,
        title: `Funding proposal ${humanize(proposal.status)}`,
        detail: `${proposal.title} · ${businessNames.get(proposal.business_id) ?? "Business"}`,
        timestamp: proposal.updated_at,
      })),
      ...documents.map((document) => ({
        id: `document-${document.id}`,
        title: `Document ${humanize(document.verification_status)}`,
        detail: document.original_filename,
        timestamp: document.uploaded_at,
      })),
      ...reports.map((report) => ({
        id: `report-${report.id}`,
        title: "Business report submitted",
        detail: businessNames.get(report.business_id) ?? "Business report",
        timestamp: report.created_at,
      })),
    ]
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, 8);
  }, [businessNames, businesses, documents, entrepreneur, proposals, reports, transactions]);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    if (name.length < 2) {
      toast.error("Enter a business name with at least two characters.");
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase.from("businesses").insert({
      owner_user_id: user.id,
      name,
      description: String(values.get("description") ?? "").trim(),
      category: String(values.get("category") ?? "").trim() || null,
      city: String(values.get("city") ?? "").trim() || null,
      country: String(values.get("country") ?? "").trim() || null,
    });
    setSaving(false);
    if (saveError) {
      toast.error(`Could not save business: ${saveError.message}`);
      return;
    }
    form.reset();
    toast.success("Business profile saved.");
    setReloadKey((key) => key + 1);
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const businessId = String(values.get("business_id") ?? "");
    const file = values.get("document");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("Choose a PDF, JPEG, or PNG document.");
      return;
    }
    if (!businesses.some((business) => business.id === businessId)) {
      toast.error("Choose one of your saved businesses.");
      return;
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type) || file.size > MAX_DOCUMENT_BYTES) {
      toast.error("Documents must be PDF, JPEG, or PNG and no larger than 10 MB.");
      return;
    }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "document";
    const storagePath = `${businessId}/${crypto.randomUUID()}-${safeName}`;
    setSaving(true);
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setSaving(false);
      toast.error(`Could not upload document: ${uploadError.message}`);
      return;
    }
    const { error: metadataError } = await supabase.from("business_documents").insert({
      business_id: businessId,
      owner_user_id: user.id,
      storage_path: storagePath,
      original_filename: file.name,
      content_type: file.type,
      size_bytes: file.size,
    });
    if (metadataError) {
      const { error: cleanupError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .remove([storagePath]);
      setSaving(false);
      toast.error(
        cleanupError
          ? `Document metadata failed and uploaded file cleanup failed: ${metadataError.message}; ${cleanupError.message}`
          : `Document metadata could not be saved; uploaded file was removed: ${metadataError.message}`,
      );
      return;
    }
    setSaving(false);
    form.reset();
    toast.success("Private document uploaded.");
    setReloadKey((key) => key + 1);
  }

  async function openDocument(document: Tables<"business_documents">) {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    const { data, error: signedUrlError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, 60);
    if (signedUrlError) {
      popup?.close();
      toast.error(`Could not open private document: ${signedUrlError.message}`);
      return;
    }
    if (popup) popup.location.href = data.signedUrl;
    else toast.error("Allow pop-ups to open this private document.");
  }

  async function deleteDocument(document: Tables<"business_documents">) {
    const { error: storageError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .remove([document.storage_path]);
    if (storageError) {
      toast.error(`Could not delete document file: ${storageError.message}`);
      return;
    }
    const { error: recordError } = await supabase
      .from("business_documents")
      .delete()
      .eq("id", document.id);
    if (recordError) {
      toast.error(
        `File removed, but document metadata could not be deleted: ${recordError.message}`,
      );
      setReloadKey((key) => key + 1);
      return;
    }
    toast.success("Document deleted.");
    setReloadKey((key) => key + 1);
  }

  async function saveProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const businessId = String(values.get("business_id") ?? "");
    const amount = Number(values.get("requested_amount"));
    const profitSharePercent = Number(values.get("profit_share"));
    const monthsText = String(values.get("term_months") ?? "");
    const termMonths = monthsText ? Number(monthsText) : null;
    const title = String(values.get("title") ?? "").trim();
    if (!businesses.some((business) => business.id === businessId)) {
      toast.error("Choose one of your saved businesses.");
      return;
    }
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(profitSharePercent) ||
      profitSharePercent < 0 ||
      profitSharePercent > 100 ||
      (termMonths !== null && (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120))
    ) {
      toast.error("Check the amount, profit share, and term values.");
      return;
    }
    const intent = values.get("workflow") === "submit" ? "submit" : "draft";
    const proposal: TablesInsert<"funding_proposals"> = {
      business_id: businessId,
      owner_user_id: user.id,
      title,
      summary: String(values.get("summary") ?? "").trim(),
      requested_amount: amount,
      entrepreneur_profit_share_bps: Math.round(profitSharePercent * 100),
      term_months: termMonths,
    };
    if (title.length < 3) {
      toast.error("Proposal title must be at least three characters.");
      return;
    }
    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("funding_proposals")
      .insert(proposal)
      .select("id")
      .single();
    if (insertError) {
      setSaving(false);
      toast.error(`Could not save proposal: ${insertError.message}`);
      return;
    }
    if (intent === "submit") {
      const { error: submitError } = await supabase
        .from("funding_proposals")
        .update({ status: "submitted" })
        .eq("id", data.id);
      if (submitError) {
        setSaving(false);
        toast.error(`Draft saved, but submission failed: ${submitError.message}`);
        setReloadKey((key) => key + 1);
        return;
      }
    }
    setSaving(false);
    form.reset();
    toast.success(intent === "submit" ? "Proposal submitted for review." : "Proposal draft saved.");
    setReloadKey((key) => key + 1);
  }

  async function submitDraft(id: string) {
    const { error: submitError } = await supabase
      .from("funding_proposals")
      .update({ status: "submitted" })
      .eq("id", id);
    if (submitError) {
      toast.error(`Could not submit proposal: ${submitError.message}`);
      return;
    }
    toast.success("Proposal submitted for review.");
    setReloadKey((key) => key + 1);
  }

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const businessId = String(values.get("business_id") ?? "");
    const periodStart = String(values.get("period_start") ?? "");
    const periodEnd = String(values.get("period_end") ?? "");
    const revenueText = String(values.get("revenue") ?? "");
    const costsText = String(values.get("costs") ?? "");
    if (
      !businesses.some((business) => business.id === businessId) ||
      !periodStart ||
      !periodEnd ||
      periodEnd < periodStart
    ) {
      toast.error("Choose a business and a valid reporting period.");
      return;
    }
    const revenue = revenueText ? Number(revenueText) : null;
    const costs = costsText ? Number(costsText) : null;
    if (
      [revenue, costs].some((value) => value !== null && (!Number.isFinite(value) || value < 0))
    ) {
      toast.error("Reported revenue and costs must be valid non-negative amounts.");
      return;
    }
    const milestones = String(values.get("milestones") ?? "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    setSaving(true);
    const { error: reportError } = await supabase.from("business_reports").insert({
      owner_user_id: user.id,
      business_id: businessId,
      period_start: periodStart,
      period_end: periodEnd,
      narrative: String(values.get("narrative") ?? "").trim(),
      entrepreneur_reported_revenue: revenue,
      entrepreneur_reported_costs: costs,
      milestones,
      attachments: [],
    });
    setSaving(false);
    if (reportError) {
      toast.error(`Could not save report: ${reportError.message}`);
      return;
    }
    form.reset();
    toast.success("Business report saved.");
    setReloadKey((key) => key + 1);
  }

  if (view === "overview") {
    return (
      <section className="workspace-records">
        <div className="workspace-record-metrics">
          {entrepreneur ? (
            <>
              <Metric label="Businesses" value={businesses.length} />
              <Metric label="Funding proposals" value={proposals.length} />
              <Metric label="Business documents" value={documents.length} />
              <Metric label="Reports submitted" value={reports.length} />
            </>
          ) : (
            <>
              <Metric label="Indexed activity" value={transactions.length} />
              <Metric label="Network" value="Solana Devnet" />
            </>
          )}
        </div>
        <section className="onboarding-card workspace-activity-card">
          <div className="workspace-section-heading">
            <div>
              <p className="eyebrow">{entrepreneur ? "YOUR BUSINESS" : "YOUR PORTFOLIO"}</p>
              <h2>{entrepreneur ? "Business activity" : "Portfolio activity"}</h2>
            </div>
            <Button
              variant="quiet"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading}
            >
              Refresh activity
            </Button>
          </div>
          {error && (
            <p className="workspace-inline-error" role="alert">
              {error}
            </p>
          )}
          {loading ? (
            <p aria-live="polite">Loading recent activity…</p>
          ) : activity.length ? (
            <ol className="workspace-activity-list">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className="workspace-activity-marker" aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <time dateTime={item.timestamp}>{formatDate(item.timestamp)}</time>
                  {item.href && (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View transaction on Solana Explorer"
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="workspace-empty workspace-activity-empty">
              <FileText aria-hidden="true" />
              <h3>
                {entrepreneur ? "No business activity yet" : "No indexed portfolio activity yet"}
              </h3>
              <p>
                {entrepreneur
                  ? "Create a business profile, proposal, report, or upload a private document to see activity here."
                  : "Confirmed wallet activity appears here after the transaction indexer records it. Your current on-chain positions remain available under My Investments."}
              </p>
            </div>
          )}
        </section>
        <WorkspaceSectionLinks entrepreneur={entrepreneur} />
      </section>
    );
  }

  if (view === "business-documents" && entrepreneur) {
    return (
      <section className="workspace-records">
        <div className="workspace-records-intro">
          <div>
            <p className="eyebrow">PRIVATE BUSINESS FILES</p>
            <h2>Business documents</h2>
          </div>
          <p>
            Files are private to your account. PDF, JPEG, or PNG up to 10 MB. Review status is
            controlled by the platform.
          </p>
        </div>
        {error && (
          <p className="workspace-inline-error" role="alert">
            {error}
          </p>
        )}
        <form
          className="onboarding-card workspace-record-form"
          onSubmit={(event) => void uploadDocument(event)}
        >
          <h3>
            <UploadCloud aria-hidden="true" /> Upload a document
          </h3>
          <div className="workspace-record-form-grid">
            <label className="proposal-field">
              <span>Business</span>
              <select name="business_id" required defaultValue="">
                <option value="" disabled>
                  Select a business
                </option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="proposal-field">
              <span>File</span>
              <input
                name="document"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                required
              />
            </label>
          </div>
          <Button
            type="submit"
            variant="gold"
            disabled={saving || loading || businesses.length === 0}
          >
            {saving ? "Uploading…" : "Upload private document"}
          </Button>
        </form>
        <RecordList
          title="Uploaded documents"
          loading={loading}
          empty="No documents have been uploaded for your businesses."
        >
          {documents.map((document) => (
            <article className="proposal-record" key={document.id}>
              <div className="proposal-record-heading">
                <div>
                  <span className="proposal-record-label">
                    {businessNames.get(document.business_id) ?? "Business"}
                  </span>
                  <h3>{document.original_filename}</h3>
                </div>
                <span
                  className={`proposal-status ${document.verification_status === "verified" ? "is-approved" : ""}`}
                >
                  {humanize(document.verification_status)}
                </span>
              </div>
              <div className="workspace-record-meta">
                <span>{(document.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                <span>{formatDate(document.uploaded_at)}</span>
              </div>
              <div className="workspace-record-actions">
                <Button type="button" variant="quiet" onClick={() => void openDocument(document)}>
                  Open securely
                </Button>
                {document.verification_status === "pending" && (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => void deleteDocument(document)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </article>
          ))}
        </RecordList>
      </section>
    );
  }

  if (view === "funding-proposals" && entrepreneur) {
    return (
      <section className="workspace-records">
        <div className="workspace-records-intro">
          <div>
            <p className="eyebrow">FINANCING REQUESTS</p>
            <h2>Funding proposals</h2>
          </div>
          <p>
            Draft proposals are private. Submission requests platform review and does not guarantee
            approval or funding.
          </p>
        </div>
        {error && (
          <p className="workspace-inline-error" role="alert">
            {error}
          </p>
        )}
        <form
          className="onboarding-card workspace-record-form"
          onSubmit={(event) => void saveProposal(event)}
        >
          <h3>
            <Plus aria-hidden="true" /> Create a funding proposal
          </h3>
          <div className="workspace-record-form-grid">
            <label className="proposal-field">
              <span>Business</span>
              <select name="business_id" required defaultValue="">
                <option value="" disabled>
                  Select a business
                </option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="proposal-field">
              <span>Proposal title</span>
              <Input name="title" required minLength={3} maxLength={180} />
            </label>
            <label className="proposal-field">
              <span>Funding target (Devnet USDC)</span>
              <Input
                name="requested_amount"
                type="number"
                min="0.000001"
                step="0.000001"
                required
              />
            </label>
            <label className="proposal-field">
              <span>Entrepreneur profit share (%)</span>
              <Input name="profit_share" type="number" min="0" max="100" step="0.01" required />
            </label>
            <label className="proposal-field">
              <span>Term (months, optional)</span>
              <Input name="term_months" type="number" min="1" max="120" step="1" />
            </label>
          </div>
          <label className="proposal-field">
            <span>Summary</span>
            <textarea name="summary" maxLength={4000} rows={4} />
          </label>
          <div className="workspace-record-actions">
            <Button
              type="submit"
              name="workflow"
              value="draft"
              variant="quiet"
              disabled={saving || loading || businesses.length === 0}
            >
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              type="submit"
              name="workflow"
              value="submit"
              variant="gold"
              disabled={saving || loading || businesses.length === 0}
            >
              {saving ? "Saving…" : "Save and submit"}
            </Button>
          </div>
        </form>
        <RecordList title="Your proposals" loading={loading} empty="No funding proposals yet.">
          {proposals.map((proposal) => (
            <article className="proposal-record" key={proposal.id}>
              <div className="proposal-record-heading">
                <div>
                  <span className="proposal-record-label">
                    {businessNames.get(proposal.business_id) ?? "Business"}
                  </span>
                  <h3>{proposal.title}</h3>
                </div>
                <span
                  className={`proposal-status ${proposal.status === "approved" ? "is-approved" : proposal.status === "rejected" ? "is-rejected" : ""}`}
                >
                  {humanize(proposal.status)}
                </span>
              </div>
              <p>{proposal.summary || "No summary provided."}</p>
              <div className="proposal-record-metrics">
                <div>
                  <span>Funding target</span>
                  <strong>{formatAmount(proposal.requested_amount)} USDC</strong>
                </div>
                <div>
                  <span>Entrepreneur share</span>
                  <strong>{(proposal.entrepreneur_profit_share_bps / 100).toFixed(2)}%</strong>
                </div>
                <div>
                  <span>Term</span>
                  <strong>
                    {proposal.term_months ? `${proposal.term_months} months` : "Not specified"}
                  </strong>
                </div>
                <div>
                  <span>Last updated</span>
                  <strong>{formatDate(proposal.updated_at)}</strong>
                </div>
              </div>
              {proposal.administrator_feedback && (
                <p className="workspace-review-feedback">
                  <strong>Platform feedback:</strong> {proposal.administrator_feedback}
                </p>
              )}
              {proposal.status === "draft" && (
                <Button
                  type="button"
                  variant="quiet"
                  disabled={saving}
                  onClick={() => void submitDraft(proposal.id)}
                >
                  Submit for review
                </Button>
              )}
              {proposal.on_chain_pool_address && (
                <a
                  className="proposal-explorer-link"
                  href={`https://explorer.solana.com/address/${proposal.on_chain_pool_address}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on-chain pool <ArrowUpRight aria-hidden="true" />
                </a>
              )}
            </article>
          ))}
        </RecordList>
      </section>
    );
  }

  if (view === "business-reports" && entrepreneur) {
    return (
      <section className="workspace-records">
        <div className="workspace-records-intro">
          <div>
            <p className="eyebrow">PROGRESS UPDATES</p>
            <h2>Business reports</h2>
          </div>
          <p>
            Revenue, costs, and milestones are entrepreneur-reported statements and are not
            independently verified.
          </p>
        </div>
        {error && (
          <p className="workspace-inline-error" role="alert">
            {error}
          </p>
        )}
        <form
          className="onboarding-card workspace-record-form"
          onSubmit={(event) => void createReport(event)}
        >
          <h3>
            <Plus aria-hidden="true" /> Submit a business report
          </h3>
          <div className="workspace-record-form-grid">
            <label className="proposal-field">
              <span>Business</span>
              <select name="business_id" required defaultValue="">
                <option value="" disabled>
                  Select a business
                </option>
                {businesses.map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="proposal-field">
              <span>Period start</span>
              <Input name="period_start" type="date" required />
            </label>
            <label className="proposal-field">
              <span>Period end</span>
              <Input name="period_end" type="date" required />
            </label>
            <label className="proposal-field">
              <span>Reported revenue (optional)</span>
              <Input name="revenue" type="number" min="0" step="0.01" />
            </label>
            <label className="proposal-field">
              <span>Reported costs (optional)</span>
              <Input name="costs" type="number" min="0" step="0.01" />
            </label>
          </div>
          <label className="proposal-field">
            <span>Business update</span>
            <textarea name="narrative" rows={4} maxLength={5000} />
          </label>
          <label className="proposal-field">
            <span>Milestones (one per line)</span>
            <textarea name="milestones" rows={3} maxLength={3000} />
          </label>
          <Button
            type="submit"
            variant="gold"
            disabled={saving || loading || businesses.length === 0}
          >
            {saving ? "Saving…" : "Save report"}
          </Button>
        </form>
        <RecordList
          title="Submitted reports"
          loading={loading}
          empty="No reports have been submitted yet."
        >
          {reports.map((report) => {
            const milestones = Array.isArray(report.milestones) ? report.milestones : [];
            return (
              <article className="proposal-record" key={report.id}>
                <div className="proposal-record-heading">
                  <div>
                    <span className="proposal-record-label">
                      {businessNames.get(report.business_id) ?? "Business"}
                    </span>
                    <h3>
                      {formatDate(report.period_start)} – {formatDate(report.period_end)}
                    </h3>
                  </div>
                  <span className="proposal-status">Entrepreneur reported</span>
                </div>
                <p>{report.narrative || "No narrative provided."}</p>
                <div className="proposal-record-metrics">
                  <div>
                    <span>Revenue reported</span>
                    <strong>{formatAmount(report.entrepreneur_reported_revenue)}</strong>
                  </div>
                  <div>
                    <span>Costs reported</span>
                    <strong>{formatAmount(report.entrepreneur_reported_costs)}</strong>
                  </div>
                  <div>
                    <span>Submitted</span>
                    <strong>{formatDate(report.created_at)}</strong>
                  </div>
                  <div>
                    <span>Milestones</span>
                    <strong>{milestones.length}</strong>
                  </div>
                </div>
                {milestones.length > 0 && (
                  <ul className="workspace-milestones">
                    {milestones.map((milestone, index) => (
                      <li key={`${report.id}-${index}`}>
                        {typeof milestone === "string" ? milestone : JSON.stringify(milestone)}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </RecordList>
      </section>
    );
  }

  return (
    <p className="workspace-inline-error" role="alert">
      This workspace section is not available for the selected role.
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RecordList({
  title,
  empty,
  loading,
  children,
}: {
  title: string;
  empty: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  const hasRecords = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="onboarding-card workspace-record-list">
      <div className="workspace-section-heading">
        <h2>{title}</h2>
        <span>{loading ? "Loading" : ""}</span>
      </div>
      {loading && <p aria-live="polite">Loading records…</p>}
      {!loading && !hasRecords && <p>{empty}</p>}
      {!loading && hasRecords && <div className="proposal-list">{children}</div>}
    </section>
  );
}

function WorkspaceSectionLinks({ entrepreneur }: { entrepreneur: boolean }) {
  const base = entrepreneur ? "/entrepreneur" : "/dashboard";
  const sections: [string, string][] = entrepreneur
    ? [
        ["overview", "Overview"],
        ["my-businesses", "My Businesses"],
        ["business-documents", "Business Documents"],
        ["funding-proposals", "Funding Proposals"],
        ["business-reports", "Business Reports"],
        ["notifications", "Notifications"],
        ["settings", "Settings"],
      ]
    : [
        ["overview", "Overview"],
        ["my-investments", "My Investments"],
        ["transactions", "Transactions"],
        ["notifications", "Notifications"],
        ["settings", "Settings"],
      ];
  return (
    <nav className="workspace-section-links" aria-label="Workspace sections">
      {sections.map(([view, label]) => (
        <Link key={view} to={base} search={{ view }}>
          <span>{label}</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

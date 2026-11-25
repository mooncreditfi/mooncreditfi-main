import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Workspace, WorkspaceTitle } from "@/components/workspace";
import { pageMetadata } from "@/lib/page-metadata";
import {
  generateAssessment,
  listAssessments,
  type ReadinessInput,
} from "@/lib/readiness.functions";

export const Route = createFileRoute("/_authenticated/readiness")({
  head: () =>
    pageMetadata(
      "Application Readiness",
      "Describe your business and financing goals to get a tailored MoonCreditFi application-readiness checklist.",
    ),
  component: Readiness,
});

type Assessment = Awaited<ReturnType<typeof listAssessments>>[number];
const fields: { name: keyof ReadinessInput; label: string; type?: string; area?: boolean }[] = [
  { name: "business_name", label: "Business name" },
  { name: "industry", label: "Industry" },
  { name: "country", label: "Country" },
  { name: "years_operating", label: "Years operating", type: "number" },
  { name: "description", label: "What does your business do?", area: true },
  { name: "requested_amount", label: "Amount sought (USDC)", type: "number" },
  { name: "duration_months", label: "Duration (months)", type: "number" },
  {
    name: "investor_profit_share_pct",
    label: "Profit share offered to investors (%)",
    type: "number",
  },
  { name: "use_of_capital", label: "How will you use the capital?", area: true },
];

function Readiness() {
  const list = useServerFn(listAssessments);
  const generate = useServerFn(generateAssessment);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const {
    data: items = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["readiness-assessments"],
    queryFn: list,
  });
  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      const row = await generate({
        data: {
          ...f,
          years_operating: Number(f["years_operating"]),
          requested_amount: Number(f["requested_amount"]),
          duration_months: Number(f["duration_months"]),
          investor_profit_share_pct: Number(f["investor_profit_share_pct"]),
        } as ReadinessInput,
      });
      setActiveId(row.id);
      await queryClient.invalidateQueries({ queryKey: ["readiness-assessments"] });
      toast.success("Your checklist is ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace>
      <WorkspaceTitle
        eyebrow="ENTREPRENEUR WORKSPACE"
        title="Application readiness"
        description="Tell us about your business and financing goals. We'll suggest what to prepare before applying."
      />
      <div className="readiness-grid">
        <form className="readiness-form" onSubmit={submit}>
          {fields.map((f) => (
            <label key={f.name}>
              <span>{f.label}</span>
              {f.area ? (
                <textarea name={f.name} required maxLength={2000} rows={3} />
              ) : (
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  required
                  min={f.type ? 0 : undefined}
                  step={f.name === "years_operating" || f.name === "duration_months" ? 1 : "any"}
                />
              )}
            </label>
          ))}
          <Button variant="gold" type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Preparing your checklist…" : "Generate checklist"}
          </Button>
        </form>
        <section className="readiness-result" aria-live="polite">
          {loadError ? (
            <div className="workspace-empty" role="alert">
              <h2>Could not load saved checklists</h2>
              <p>{loadError instanceof Error ? loadError.message : "Please try again."}</p>
              <Button
                variant="quiet"
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: ["readiness-assessments"] })
                }
              >
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <p>Loading your saved checklists…</p>
          ) : active ? (
            <>
              <div className="readiness-score" aria-label="Assessment status">
                <strong>Not scored</strong>
                <span>{active.business_name} · AI-generated preparation guidance</span>
              </div>
              <p className="readiness-disclosure">
                MoonCreditFi has not verified your financial records, identity, or business
                documents. This checklist is not a credit score or funding decision.
              </p>
              <p>{active.summary}</p>
              <ul>
                {active.checklist.map((c, i) => (
                  <li key={i} data-priority={c.priority}>
                    <ClipboardCheck />
                    <div>
                      <small>
                        {c.category} · {c.priority} priority
                      </small>
                      <h3>{c.title}</h3>
                      <p>{c.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {items.length > 1 && (
                <div className="readiness-history">
                  <span>Earlier checklists:</span>
                  {items.map((a) => (
                    <Button
                      key={a.id}
                      variant="nav"
                      className={a.id === active.id ? "selected" : ""}
                      onClick={() => setActiveId(a.id)}
                    >
                      {a.business_name} · {new Date(a.created_at).toLocaleDateString()}
                    </Button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="workspace-empty">
              <div className="icon-tile">
                <ClipboardCheck />
              </div>
              <h2>No checklist yet</h2>
              <p>Fill in the form to get your tailored checklist.</p>
            </div>
          )}
        </section>
      </div>
      <p className="risk-note">
        <CircleAlert />
        This checklist is AI-generated guidance, not approval, legal advice or a promise of funding.
        Mudarabah returns are not guaranteed and capital is at risk.
      </p>
    </Workspace>
  );
}

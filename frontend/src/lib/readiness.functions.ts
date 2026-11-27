import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChecklistItem = {
  category: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};
export type ReadinessInput = {
  business_name: string;
  industry: string;
  country: string;
  years_operating: number;
  description: string;
  requested_amount: number;
  duration_months: number;
  investor_profit_share_pct: number;
  use_of_capital: string;
};

function validate(i: ReadinessInput): ReadinessInput {
  const text = (v: unknown, max: number) => {
    const s = String(v ?? "").trim();
    if (!s || s.length > max) throw new Error("Please complete every field.");
    return s;
  };
  const num = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max)
      throw new Error("Please check the numbers you entered.");
    return n;
  };
  const whole = (v: unknown, min: number, max: number) => {
    const n = num(v, min, max);
    if (!Number.isInteger(n))
      throw new Error("Years operating and duration must be whole numbers.");
    return n;
  };
  return {
    business_name: text(i.business_name, 120),
    industry: text(i.industry, 80),
    country: text(i.country, 80),
    years_operating: whole(i.years_operating, 0, 200),
    description: text(i.description, 2000),
    requested_amount: num(i.requested_amount, 1, 100_000_000),
    duration_months: whole(i.duration_months, 1, 120),
    investor_profit_share_pct: num(i.investor_profit_share_pct, 1, 99),
    use_of_capital: text(i.use_of_capital, 2000),
  };
}

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("readiness_assessments")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error("Could not load your checklists.");
    return data.map((r) => ({ ...r, checklist: r.checklist as unknown as ChecklistItem[] }));
  });

export const generateAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validate)
  .handler(async ({ data, context }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["summary", "checklist"],
      properties: {
        summary: { type: "string" },
        checklist: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["category", "title", "detail", "priority"],
            properties: {
              category: {
                type: "string",
                enum: [
                  "Legal & registration",
                  "Financial records",
                  "Mudarabah terms",
                  "Use of capital",
                  "Risk disclosure",
                  "Identity & verification",
                ],
              },
              title: { type: "string" },
              detail: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
      },
    } as const;
    let text = "";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "You help entrepreneurs prepare a Mudarabah (profit-sharing, no fixed interest, no guaranteed returns) financing application for MoonCreditFi. Produce a tailored checklist of 8-12 concrete items based only on the submitted business profile and financing goals: documents to gather for their country and stage, financial records, whether the requested amount aligns with the stated use of capital and operating history, whether the proposed profit share and duration need professional review, and risk disclosures. Do not assign a numerical readiness or credit score: the platform has no verified financial statements, documentation, or credit-history data. Never imply information is verified or promise funding, approval or returns. Be specific and practical.",
        input: JSON.stringify(data),
        text: { format: { type: "json_schema", name: "readiness", strict: true, schema } },
      });
      for (const item of res.output ?? []) {
        if (item.type === "message")
          for (const c of item.content) if (c.type === "output_text") text += c.text;
      }
    } catch (e) {
      console.error(e);
      if (e instanceof GatewayError && e.httpStatus === 429)
        throw new Error("The assistant is busy. Please try again in a minute.");
      if (e instanceof GatewayError && e.httpStatus === 402)
        throw new Error("AI credits are used up. Please top up to continue.");
      throw new Error("The checklist could not be generated. Please try again.");
    }
    let parsed: { summary: string; checklist: ChecklistItem[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("The checklist could not be generated. Please try again.");
    }
    const { data: row, error } = await context.supabase
      .from("readiness_assessments")
      .insert({
        ...data,
        user_id: context.userId,
        readiness_score: null,
        summary: parsed.summary,
        checklist: parsed.checklist,
      })
      .select("*")
      .single();
    if (error) throw new Error("Could not save your checklist.");
    return { ...row, checklist: row.checklist as unknown as ChecklistItem[] };
  });

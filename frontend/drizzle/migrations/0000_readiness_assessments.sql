CREATE TABLE public.readiness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  business_name text NOT NULL,
  industry text NOT NULL,
  country text NOT NULL,
  years_operating integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  requested_amount numeric NOT NULL,
  duration_months integer NOT NULL,
  investor_profit_share_pct numeric NOT NULL,
  use_of_capital text NOT NULL,
  readiness_score integer,
  summary text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_assessments TO authenticated;
GRANT ALL ON public.readiness_assessments TO service_role;
ALTER TABLE public.readiness_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read" ON public.readiness_assessments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert" ON public.readiness_assessments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update" ON public.readiness_assessments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners delete" ON public.readiness_assessments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ON public.readiness_assessments (user_id, created_at DESC);
-- MoonCreditFi application records. On-chain positions and pool balances remain authoritative;
-- this schema stores private business/proposal/reporting data and a backend index of confirmed events.

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  description text NOT NULL DEFAULT '',
  category text,
  country text,
  city text,
  business_registration_status text NOT NULL DEFAULT 'not_provided'
    CHECK (business_registration_status IN ('not_provided', 'submitted', 'reviewing', 'verified', 'rejected')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, owner_user_id)
);

CREATE INDEX IF NOT EXISTS businesses_owner_updated_idx
  ON public.businesses (owner_user_id, updated_at DESC);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Business owners manage their businesses" ON public.businesses;
CREATE POLICY "Business owners manage their businesses"
  ON public.businesses FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_business_protected_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' AND (NEW.verification_status <> 'unverified' OR NEW.business_registration_status <> 'not_provided') THEN
      RAISE EXCEPTION 'Verification fields are controlled by platform review';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR
      NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
      NEW.business_registration_status IS DISTINCT FROM OLD.business_registration_status
    ) THEN
      RAISE EXCEPTION 'Ownership and verification fields cannot be changed by business owners';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_business_protected_fields ON public.businesses;
CREATE TRIGGER guard_business_protected_fields
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_protected_fields();

CREATE TABLE IF NOT EXISTS public.funding_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  summary text NOT NULL DEFAULT '',
  requested_amount numeric(20, 6) NOT NULL CHECK (requested_amount > 0),
  token_mint text NOT NULL DEFAULT '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  entrepreneur_profit_share_bps integer NOT NULL CHECK (entrepreneur_profit_share_bps BETWEEN 0 AND 10000),
  term_months integer CHECK (term_months IS NULL OR term_months BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'changes_requested', 'approved', 'rejected')),
  administrator_feedback text,
  on_chain_proposal_address text,
  on_chain_pool_address text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funding_proposals_business_owner_fk
    FOREIGN KEY (business_id, owner_user_id) REFERENCES public.businesses(id, owner_user_id) ON DELETE CASCADE,
  UNIQUE (id, owner_user_id)
);
CREATE INDEX IF NOT EXISTS funding_proposals_owner_updated_idx
  ON public.funding_proposals (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS funding_proposals_status_idx ON public.funding_proposals (status, submitted_at);
ALTER TABLE public.funding_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Proposal owners read their proposals" ON public.funding_proposals;
CREATE POLICY "Proposal owners read their proposals"
  ON public.funding_proposals FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Proposal owners create drafts" ON public.funding_proposals;
CREATE POLICY "Proposal owners create drafts"
  ON public.funding_proposals FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND status = 'draft');
DROP POLICY IF EXISTS "Proposal owners edit drafts and submit" ON public.funding_proposals;
CREATE POLICY "Proposal owners edit drafts and submit"
  ON public.funding_proposals FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() AND status = 'draft')
  WITH CHECK (owner_user_id = auth.uid() AND status IN ('draft', 'submitted'));
GRANT SELECT, INSERT, UPDATE ON public.funding_proposals TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_proposal_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF TG_OP = 'INSERT' AND (NEW.status <> 'draft' OR NEW.administrator_feedback IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.on_chain_proposal_address IS NOT NULL OR NEW.on_chain_pool_address IS NOT NULL) THEN
      RAISE EXCEPTION 'New proposals must be drafts; review and chain fields are system-controlled';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR
      NEW.business_id IS DISTINCT FROM OLD.business_id OR
      NEW.administrator_feedback IS DISTINCT FROM OLD.administrator_feedback OR
      NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
      NEW.on_chain_proposal_address IS DISTINCT FROM OLD.on_chain_proposal_address OR
      NEW.on_chain_pool_address IS DISTINCT FROM OLD.on_chain_pool_address OR
      (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'draft' AND NEW.status = 'submitted'))
    ) THEN
      RAISE EXCEPTION 'Proposal review state and blockchain links are controlled by authorized backend workflows';
    END IF;
  END IF;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_proposal_workflow ON public.funding_proposals;
CREATE TRIGGER guard_proposal_workflow
  BEFORE INSERT OR UPDATE ON public.funding_proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_workflow();

CREATE TABLE IF NOT EXISTS public.business_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'reviewing', 'verified', 'rejected')),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT business_documents_business_owner_fk
    FOREIGN KEY (business_id, owner_user_id) REFERENCES public.businesses(id, owner_user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS business_documents_owner_idx ON public.business_documents (owner_user_id, business_id);
ALTER TABLE public.business_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Document owners read metadata" ON public.business_documents;
CREATE POLICY "Document owners read metadata"
  ON public.business_documents FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
DROP POLICY IF EXISTS "Document owners register uploads" ON public.business_documents;
CREATE POLICY "Document owners register uploads"
  ON public.business_documents FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND verification_status = 'pending' AND reviewed_at IS NULL);
DROP POLICY IF EXISTS "Document owners delete pending uploads" ON public.business_documents;
CREATE POLICY "Document owners delete pending uploads"
  ON public.business_documents FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() AND verification_status = 'pending');
GRANT SELECT, INSERT, DELETE ON public.business_documents TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_document_review_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR
    NEW.business_id IS DISTINCT FROM OLD.business_id OR
    NEW.storage_path IS DISTINCT FROM OLD.storage_path OR
    NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
    NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
  ) THEN
    RAISE EXCEPTION 'Document ownership and verification fields are controlled by the platform';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_document_review_fields ON public.business_documents;
CREATE TRIGGER guard_document_review_fields
  BEFORE UPDATE ON public.business_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_review_fields();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mooncredit-business-documents', 'mooncredit-business-documents', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];
DROP POLICY IF EXISTS "Business owners read private documents" ON storage.objects;
CREATE POLICY "Business owners read private documents" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'mooncredit-business-documents' AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Business owners upload private documents" ON storage.objects;
CREATE POLICY "Business owners upload private documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'mooncredit-business-documents' AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Business owners delete private documents" ON storage.objects;
CREATE POLICY "Business owners delete private documents" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'mooncredit-business-documents' AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1] AND b.owner_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.business_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  narrative text NOT NULL DEFAULT '',
  entrepreneur_reported_revenue numeric(20, 6),
  entrepreneur_reported_costs numeric(20, 6),
  milestones jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(milestones) = 'array'),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_reports_business_owner_fk
    FOREIGN KEY (business_id, owner_user_id) REFERENCES public.businesses(id, owner_user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS business_reports_owner_period_idx
  ON public.business_reports (owner_user_id, business_id, period_end DESC);
ALTER TABLE public.business_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Business owners manage reports" ON public.business_reports;
CREATE POLICY "Business owners manage reports" ON public.business_reports
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_reports TO authenticated;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'proposal_submitted', 'proposal_approved', 'proposal_rejected', 'changes_requested',
    'pool_created', 'funding_goal_reached', 'investment_received', 'settlement_submitted',
    'settlement_approved', 'profit_distribution_available', 'refund_available', 'announcement'
  )),
  title text NOT NULL,
  message text NOT NULL,
  related_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  related_pool_address text,
  related_transaction_signature text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, UPDATE ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_notification_read_state()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.notification_type IS DISTINCT FROM OLD.notification_type OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.message IS DISTINCT FROM OLD.message OR
    NEW.related_business_id IS DISTINCT FROM OLD.related_business_id OR
    NEW.related_pool_address IS DISTINCT FROM OLD.related_pool_address OR
    NEW.related_transaction_signature IS DISTINCT FROM OLD.related_transaction_signature OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Users may only update notification read state';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_notification_read_state ON public.notifications;
CREATE TRIGGER guard_notification_read_state
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_read_state();

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;

-- Indexer-owned, transactionally unique event ledger. The service role must create rows only after
-- getTransaction/confirmations establish a finalized/confirmed successful Solana transaction.
CREATE TABLE IF NOT EXISTS public.indexed_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature text NOT NULL,
  event_index integer NOT NULL DEFAULT 0 CHECK (event_index >= 0),
  program_id text NOT NULL,
  instruction_type text NOT NULL,
  transaction_status text NOT NULL CHECK (transaction_status IN ('confirmed', 'finalized', 'failed')),
  slot bigint NOT NULL CHECK (slot >= 0),
  block_time timestamptz,
  wallet_address text,
  pool_address text,
  proposal_address text,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  amount_base_units numeric(30, 0),
  token_mint text,
  raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signature, event_index)
);
CREATE INDEX IF NOT EXISTS indexed_transactions_wallet_time_idx
  ON public.indexed_transactions (wallet_address, block_time DESC);
CREATE INDEX IF NOT EXISTS indexed_transactions_pool_time_idx
  ON public.indexed_transactions (pool_address, block_time DESC);
ALTER TABLE public.indexed_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Confirmed transaction ledger is publicly readable" ON public.indexed_transactions;
CREATE POLICY "Confirmed transaction ledger is publicly readable"
  ON public.indexed_transactions FOR SELECT TO anon, authenticated
  USING (transaction_status IN ('confirmed', 'finalized'));
GRANT SELECT ON public.indexed_transactions TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.indexed_transactions FROM anon, authenticated;
GRANT ALL ON public.indexed_transactions TO service_role;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_time_idx ON public.audit_logs (entity_type, entity_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
GRANT ALL ON public.audit_logs TO service_role;

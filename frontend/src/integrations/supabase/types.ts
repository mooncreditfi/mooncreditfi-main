export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type BusinessRow = {
  id: string;
  owner_user_id: string;
  name: string;
  description: string;
  category: string | null;
  country: string | null;
  city: string | null;
  verification_status: string;
  business_registration_status: string;
  visibility: string;
  created_at: string;
  updated_at: string;
};
type FundingProposalRow = {
  id: string;
  business_id: string;
  owner_user_id: string;
  title: string;
  summary: string;
  requested_amount: number;
  token_mint: string;
  entrepreneur_profit_share_bps: number;
  term_months: number | null;
  status: string;
  administrator_feedback: string | null;
  on_chain_proposal_address: string | null;
  on_chain_pool_address: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
type BusinessDocumentRow = {
  id: string;
  business_id: string;
  owner_user_id: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  verification_status: string;
  uploaded_at: string;
  reviewed_at: string | null;
};
type BusinessReportRow = {
  id: string;
  business_id: string;
  owner_user_id: string;
  period_start: string;
  period_end: string;
  narrative: string;
  entrepreneur_reported_revenue: number | null;
  entrepreneur_reported_costs: number | null;
  milestones: Json;
  attachments: Json;
  created_at: string;
  updated_at: string;
};
type IndexedTransactionRow = {
  id: string;
  signature: string;
  event_index: number;
  program_id: string;
  instruction_type: string;
  transaction_status: string;
  slot: number;
  block_time: string | null;
  wallet_address: string | null;
  pool_address: string | null;
  proposal_address: string | null;
  business_id: string | null;
  amount_base_units: string | null;
  token_mint: string | null;
  raw_event: Json;
  indexed_at: string;
};
type NotificationRow = {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  related_business_id: string | null;
  related_pool_address: string | null;
  related_transaction_signature: string | null;
  read_at: string | null;
  created_at: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      mooncredit_profiles: Table<{
        city: string;
        country: string;
        created_at: string;
        email: string;
        full_name: string;
        phone: string;
        profile_image: string | null;
        roles: string[];
        updated_at: string;
        user_id: string;
        wallet_address: string | null;
      }>;
      readiness_assessments: Table<{
        business_name: string;
        checklist: Json;
        country: string;
        created_at: string;
        description: string;
        duration_months: number;
        id: string;
        industry: string;
        investor_profit_share_pct: number;
        readiness_score: number | null;
        requested_amount: number;
        summary: string | null;
        use_of_capital: string;
        user_id: string;
        years_operating: number;
      }>;
      businesses: Table<BusinessRow>;
      funding_proposals: Table<FundingProposalRow>;
      business_documents: Table<BusinessDocumentRow>;
      business_reports: Table<BusinessReportRow>;
      indexed_transactions: Table<IndexedTransactionRow>;
      notifications: Table<NotificationRow>;
      notification_preferences: Table<{
        user_id: string;
        in_app_enabled: boolean;
        updated_at: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof DatabaseWithoutInternals, "public">];
export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never;
export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer Insert;
    }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer Insert }
      ? Insert
      : never
    : never;
export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer Update;
    }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer Update }
      ? Update
      : never
    : never;
export const Constants = { public: { Enums: {} } } as const;

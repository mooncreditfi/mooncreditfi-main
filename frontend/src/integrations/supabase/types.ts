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
      indexed_transactions: Table<IndexedTransactionRow>;
      notifications: Table<NotificationRow>;
      notification_preferences: Table<{
        user_id: string;
        in_app_enabled: boolean;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type DefaultSchema = Database["public"];
export type Tables<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Row"];
export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Insert"];
export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Update"];
export const Constants = { public: { Enums: {} } } as const;

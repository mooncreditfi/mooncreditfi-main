CREATE TABLE public.mooncredit_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  profile_image text,
  roles text[] NOT NULL DEFAULT '{}'::text[],
  wallet_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mooncredit_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MoonCredit profiles are owner readable"
  ON public.mooncredit_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "MoonCredit profiles are owner writable"
  ON public.mooncredit_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "MoonCredit profiles are owner updateable"
  ON public.mooncredit_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.mooncredit_profiles TO authenticated;
GRANT ALL ON public.mooncredit_profiles TO service_role;

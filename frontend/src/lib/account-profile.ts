import { supabase } from '@/integrations/supabase/client';

export type MoonCreditRole = 'entrepreneur' | 'investor';

export type MoonCreditProfile = {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  profile_image?: string | undefined;
  roles: MoonCreditRole[];
};

export function getMoonCreditProfile(user: { user_metadata?: Record<string, unknown> } | null): MoonCreditProfile | null {
  const savedProfile = user?.user_metadata?.['mooncredit_profile'];
  if (!savedProfile || typeof savedProfile !== 'object') return null;
  const profile = savedProfile as Partial<MoonCreditProfile>;
  if (!profile.full_name || !profile.email || !profile.phone || !profile.country || !profile.city || !Array.isArray(profile.roles) || profile.roles.length === 0) {
    return null;
  }
  return profile as MoonCreditProfile;
}

export async function saveMoonCreditProfile(profile: MoonCreditProfile) {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      mooncredit_profile: profile,
      mooncredit_roles: profile.roles,
    },
  });
  if (error) throw error;
  return data.user;
}

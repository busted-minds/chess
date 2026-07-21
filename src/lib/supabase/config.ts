export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseAdminConfig = SupabasePublicConfig & {
  secretKey: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

const supabaseSecretKey = (
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY
)?.trim();

const isUsableUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  if (!isUsableUrl(supabaseUrl) || !supabasePublishableKey) return null;
  return { url: supabaseUrl, publishableKey: supabasePublishableKey };
}

export function getSupabaseAdminConfig(): SupabaseAdminConfig | null {
  const publicConfig = getSupabasePublicConfig();
  if (!publicConfig || !supabaseSecretKey) return null;
  return { ...publicConfig, secretKey: supabaseSecretKey };
}

export const isSupabaseConfigured = (): boolean =>
  getSupabasePublicConfig() !== null;

export const isSupabaseAdminConfigured = (): boolean =>
  getSupabaseAdminConfig() !== null;

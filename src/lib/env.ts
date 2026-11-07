/** Supabase is enabled only when the URL, anon key and service-role key are all set. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Browser-safe flag: true when public Supabase auth can be offered. */
export const publicAuthEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://balloonbluebook.com").replace(/\/$/, "");

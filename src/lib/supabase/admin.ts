import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

let client: SupabaseClient | null = null;

/** Service-role client. Server only. Never import from a client component. */
export function getServiceClient(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

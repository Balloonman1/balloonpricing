import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicAuthEnabled, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Per-request client acting as the signed-in user (RLS applies). */
export async function getUserClient() {
  if (!publicAuthEnabled) return null;
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<{ id: string; email?: string } | null> {
  const client = await getUserClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null;
}

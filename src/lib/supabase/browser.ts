"use client";
import { createBrowserClient } from "@supabase/ssr";
import { publicAuthEnabled, supabaseAnonKey, supabaseUrl } from "@/lib/env";

export function getBrowserClient() {
  if (!publicAuthEnabled) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

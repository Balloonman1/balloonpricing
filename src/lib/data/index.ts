import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/admin";
import { demoRepository } from "./demo-store";
import { createSupabaseRepository } from "./supabase-store";
import type { Repository } from "./types";

let repo: Repository | null = null;

export function getRepository(): Repository {
  if (!repo) repo = isSupabaseConfigured() ? createSupabaseRepository(getServiceClient()) : demoRepository;
  return repo;
}

export * from "./types";

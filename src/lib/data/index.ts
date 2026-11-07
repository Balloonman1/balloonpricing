import "server-only";
import { DEFAULT_CONFIG } from "@/lib/engine/defaults";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/admin";
import { blobsRepository } from "./blobs-store";
import { demoRepository } from "./demo-store";
import { createSupabaseRepository } from "./supabase-store";
import type { ConfigRecord, Repository } from "./types";

let repo: Repository | null = null;

const isBuild = () => process.env.NEXT_PHASE === "phase-production-build";

/** True when running on Netlify, where Netlify Blobs is available without setup. */
function onNetlify(): boolean {
  if (process.env.BLUEBOOK_STORAGE === "memory") return false;
  return process.env.BLUEBOOK_STORAGE === "blobs" || Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_SITE_ID);
}

/**
 * Storage selection, in order: Supabase when configured, Netlify Blobs on Netlify,
 * otherwise local demo storage (memory mirrored to a JSON file).
 */
export function getRepository(): Repository {
  if (!repo) {
    if (isSupabaseConfigured()) repo = createSupabaseRepository(getServiceClient());
    else if (onNetlify() && !isBuild()) repo = blobsRepository;
    else repo = demoRepository;
  }
  return repo;
}

/** Active pricing for static content pages. Falls back to the defaults if storage is unreachable (e.g. during a build). */
export async function getActiveConfigSafe(): Promise<ConfigRecord> {
  if (isBuild() && !isSupabaseConfigured()) return defaultRecord();
  try {
    return await getRepository().getActiveConfig();
  } catch {
    return defaultRecord();
  }
}

function defaultRecord(): ConfigRecord {
  return { id: "default", version: DEFAULT_CONFIG.version, label: DEFAULT_CONFIG.label, createdAt: new Date(0).toISOString(), isActive: true, snapshot: DEFAULT_CONFIG };
}

export * from "./types";

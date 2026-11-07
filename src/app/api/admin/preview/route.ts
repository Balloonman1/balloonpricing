import { fail, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRepository } from "@/lib/data";
import { REFERENCE_CASES } from "@/lib/reference-cases";
import { configSchema } from "@/lib/engine/schema";
import type { ValuationConfig } from "@/lib/engine/types";
import { valuate } from "@/lib/engine/valuate";

/** Shows how a draft configuration changes the reference cases before it is saved. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await readJson(req, 1_000_000).catch(() => null)) as { snapshot?: unknown } | null;
  const parsed = configSchema.safeParse({ ...((body?.snapshot as object) ?? {}), version: 1 });
  if (!parsed.success) return fail("Some settings are invalid.", 422, { issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) });
  const active = await getRepository().getActiveConfig();
  const asOf = new Date();
  const rows = REFERENCE_CASES.map((c) => {
    const before = valuate(c.input, active.snapshot, { asOf });
    const after = valuate(c.input, parsed.data as ValuationConfig, { asOf });
    return { name: c.name, beforeCents: before.fairMarketValueCents, afterCents: after.fairMarketValueCents };
  });
  return json({ rows, activeVersion: active.version });
}

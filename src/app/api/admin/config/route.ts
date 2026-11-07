import { fail, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRepository } from "@/lib/data";
import { configSchema } from "@/lib/engine/schema";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const repo = getRepository();
  return json({ active: await repo.getActiveConfig(), versions: await repo.listConfigs() });
}

/** Saves a new configuration version. Previous versions are never modified. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await readJson(req, 1_000_000).catch(() => null)) as { snapshot?: unknown; label?: string; notes?: string; activate?: boolean } | null;
  if (!body?.snapshot) return fail("Missing configuration.");
  const parsed = configSchema.safeParse({ ...(body.snapshot as object), version: 1 });
  if (!parsed.success) return fail("Some settings are invalid.", 422, { issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) });
  const s = parsed.data;
  if (s.agePolicy.capStartAge > s.agePolicy.capEndAge) return fail("The age cap must start before it ends.", 422);
  const { version: _drop, ...snapshot } = s;
  void _drop;
  const record = await getRepository().createConfigVersion(snapshot, {
    label: body.label?.slice(0, 200),
    notes: body.notes?.slice(0, 2000),
    createdBy: "admin",
    activate: body.activate !== false,
  });
  return json({ config: record }, 201);
}

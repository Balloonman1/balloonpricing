import { fail, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRepository } from "@/lib/data";

/** Applies an approved manufacturer adjustment by creating a new configuration version. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await readJson(req).catch(() => ({}))) as { manufacturer?: string; adjustment?: number; sampleSize?: number };
  if (!body.manufacturer || typeof body.adjustment !== "number" || body.adjustment < 0.1 || body.adjustment > 3) return fail("Invalid adjustment.");
  const repo = getRepository();
  const active = await repo.getActiveConfig();
  const { version: _v, ...snapshot } = active.snapshot;
  void _v;
  const record = await repo.createConfigVersion(
    { ...snapshot, manufacturerAdjustments: { ...snapshot.manufacturerAdjustments, [body.manufacturer]: Math.round(body.adjustment * 100) / 100 } },
    { label: `${body.manufacturer} adjustment ×${body.adjustment.toFixed(2)}`, notes: `Approved from calibration review (${body.sampleSize ?? "?"} verified sales).`, createdBy: "admin" },
  );
  return json({ config: record }, 201);
}

import { fail, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRepository } from "@/lib/data";
import type { SaleComparable } from "@/lib/engine/calibration";
import { valuationInputSchema } from "@/lib/engine/schema";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return json({ comparables: await getRepository().listComparables() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const c = (await readJson(req).catch(() => null)) as SaleComparable | null;
  if (!c?.manufacturer?.trim()) return fail("Manufacturer is required.");
  if (!["asking", "reported", "verified"].includes(c.verification)) return fail("Choose a verification status.");
  if (c.verification === "asking" && c.salePriceCents) return fail("An asking-price record cannot have a final sale price.");
  if (c.verification === "verified" && (!c.salePriceCents || !c.dateSold)) return fail("Verified completed sales need a final price and date sold.");
  if (c.valuationInput) {
    const parsed = valuationInputSchema.safeParse(c.valuationInput);
    if (!parsed.success) return fail("The equipment details are incomplete for a model prediction.", 422, { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  const saved = await getRepository().upsertComparable({ ...c, salePriceCents: c.verification === "asking" ? undefined : c.salePriceCents });
  return json({ comparable: saved }, 201);
}

import { fail, json, readJson } from "@/lib/api";
import { getRepository } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/security";
import { createValuation, ownerView } from "@/lib/services/valuations";
import { getCurrentUser } from "@/lib/supabase/server";

export async function POST(req: Request) {
  if (!rateLimit(`valuate:${clientIp(req)}`, 40, 60_000)) return fail("Too many valuations in a short time. Wait a minute and try again.", 429);
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail("The request could not be read.");
  }
  const user = await getCurrentUser().catch(() => null);
  const result = await createValuation(getRepository(), body, user?.id ?? null);
  if (!result.ok) return fail("Some details need attention.", 422, { issues: result.issues });
  return json({ valuation: ownerView(result.valuation), editToken: result.editToken }, 201);
}

import { fail, UUID_RE } from "@/lib/api";
import { getRepository } from "@/lib/data";
import { canEdit } from "@/lib/services/valuations";
import { getCurrentUser } from "@/lib/supabase/server";

/** Loads a valuation the caller may edit: creator token (x-edit-token header) or signed-in owner. */
export async function loadOwned(req: Request, id: string) {
  if (!UUID_RE.test(id)) return { error: fail("Valuation not found.", 404) };
  const repo = getRepository();
  const v = await repo.getValuation(id);
  if (!v) return { error: fail("Valuation not found.", 404) };
  const user = await getCurrentUser().catch(() => null);
  if (!canEdit(v, req.headers.get("x-edit-token"), user?.id)) return { error: fail("Valuation not found.", 404) };
  return { repo, v, user };
}

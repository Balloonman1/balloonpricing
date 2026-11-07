import { fail, json } from "@/lib/api";
import { ownerView } from "@/lib/services/valuations";
import { loadOwned } from "../guard";

/** Saves an anonymous valuation to the signed-in account. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await loadOwned(req, id);
  if ("error" in owned) return owned.error;
  if (!owned.user) return fail("Sign in to save valuations to an account.", 401);
  const updated = await owned.repo.updateValuation(id, { userId: owned.user.id });
  return json({ valuation: ownerView(updated!) });
}

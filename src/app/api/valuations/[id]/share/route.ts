import { fail, json, readJson } from "@/lib/api";
import { randomToken } from "@/lib/security";
import { ownerView } from "@/lib/services/valuations";
import { loadOwned } from "../guard";

/** Opt-in sharing. Turning sharing off revokes the link; turning it on again issues a new one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await loadOwned(req, id);
  if ("error" in owned) return owned.error;
  let body: { enabled?: boolean };
  try {
    body = (await readJson(req)) as { enabled?: boolean };
  } catch {
    return fail("The request could not be read.");
  }
  const enabled = body.enabled !== false;
  const updated = await owned.repo.updateValuation(id, {
    isShared: enabled,
    shareId: enabled ? (owned.v.isShared && owned.v.shareId ? owned.v.shareId : randomToken(18)) : null,
  });
  return json({ valuation: ownerView(updated!) });
}

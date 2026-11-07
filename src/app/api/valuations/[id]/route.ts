import { fail, json, readJson } from "@/lib/api";
import { ownerView, recalculateValuation } from "@/lib/services/valuations";
import { loadOwned } from "./guard";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const owned = await loadOwned(req, id);
  if ("error" in owned) return owned.error;
  return json({ valuation: ownerView(owned.v) });
}

/** Edit and recalculate under the current pricing configuration. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const owned = await loadOwned(req, id);
  if ("error" in owned) return owned.error;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return fail("The request could not be read.");
  }
  const result = await recalculateValuation(owned.repo, owned.v, body);
  if (!result.ok) return fail("Some details need attention.", 422, { issues: result.issues });
  return json({ valuation: ownerView(result.valuation) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const owned = await loadOwned(req, id);
  if ("error" in owned) return owned.error;
  await owned.repo.deleteValuation(id);
  return json({ deleted: true });
}

import { fail, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRepository } from "@/lib/data";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await readJson(req).catch(() => ({}))) as { version?: number };
  if (!Number.isInteger(body.version)) return fail("Choose a version to activate.");
  try {
    await getRepository().activateConfig(body.version!);
  } catch {
    return fail("That version does not exist.", 404);
  }
  return json({ ok: true });
}

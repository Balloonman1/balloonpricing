import { fail, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { comparablesFromCsv } from "@/lib/comparables-csv";
import { getRepository } from "@/lib/data";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const text = await req.text();
  if (text.length > 2_000_000) return fail("The file is larger than 2 MB. Split it and import in parts.");
  const { comparables, errors } = comparablesFromCsv(text);
  const repo = getRepository();
  let imported = 0;
  for (const c of comparables) {
    await repo.upsertComparable({ ...c, id: "" });
    imported++;
  }
  return json({ imported, errors });
}

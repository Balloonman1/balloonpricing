import { requireAdmin } from "@/lib/auth/require-admin";
import { comparablesToCsv } from "@/lib/comparables-csv";
import { getRepository } from "@/lib/data";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const csv = comparablesToCsv(await getRepository().listComparables());
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="balloon-bluebook-comparables-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

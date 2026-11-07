import { json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getRepository } from "@/lib/data";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  await getRepository().deleteComparable(id);
  return json({ deleted: true });
}

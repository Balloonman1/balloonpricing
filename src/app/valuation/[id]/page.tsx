import type { Metadata } from "next";
import { publicAuthEnabled } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { OwnerReport } from "./owner-report";

export const metadata: Metadata = { title: "Valuation report", robots: { index: false, follow: false } };

export default async function ValuationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser().catch(() => null);
  return <OwnerReport id={id} authEnabled={publicAuthEnabled} signedIn={Boolean(user)} />;
}

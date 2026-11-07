import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { publicView } from "@/lib/services/valuations";
import { SharedReport } from "./shared-report";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared valuation report", robots: { index: false, follow: false } };

export default async function SharedPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(shareId)) notFound();
  const v = await getRepository().getValuationByShareId(shareId);
  if (!v) notFound();
  const pub = publicView(v);
  return <SharedReport data={pub} />;
}

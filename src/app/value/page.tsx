import type { Metadata } from "next";
import { Wizard } from "./wizard";

export const metadata: Metadata = {
  title: "Value my balloon",
  description: "Enter your hot air balloon details for an instant fair market value, selling range and recommended listing price.",
  alternates: { canonical: "/value" },
};

export default async function ValuePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <Wizard key={edit ?? "new"} editId={edit} />;
}

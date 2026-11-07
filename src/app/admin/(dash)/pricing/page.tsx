import { getRepository } from "@/lib/data";
import { PricingEditor } from "./editor";

export default async function PricingPage() {
  const active = await getRepository().getActiveConfig();
  return <PricingEditor key={active.version} initial={active.snapshot} />;
}

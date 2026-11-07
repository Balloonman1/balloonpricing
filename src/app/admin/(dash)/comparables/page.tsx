import { getRepository } from "@/lib/data";
import { ComparablesManager } from "./manager";

export default async function ComparablesPage() {
  const repo = getRepository();
  const [comparables, config] = await Promise.all([repo.listComparables(), repo.getActiveConfig()]);
  return <ComparablesManager initial={comparables} burners={config.snapshot.burnerModels} />;
}

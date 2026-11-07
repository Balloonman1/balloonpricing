import { json } from "@/lib/api";
import { getRepository } from "@/lib/data";

/** Public reference data the wizard needs from the active pricing configuration. */
export async function GET() {
  const config = await getRepository().getActiveConfig();
  const s = config.snapshot;
  return json({
    configVersion: config.version,
    burnerModels: s.burnerModels,
    basketModels: s.basketModels,
    accessories: s.accessories,
    features: s.features,
    tankPrices: s.tankPrices,
  });
}

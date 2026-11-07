import { Badge, Panel } from "@/components/ui";
import { getRepository } from "@/lib/data";
import type { ValuationConfig } from "@/lib/engine/types";
import { ActivateButton } from "./activate-button";

const SECTION_LABEL: Record<string, string> = {
  envelopePrices: "Envelope prices",
  manufacturerEnvelopePrices: "Manufacturer envelope prices",
  racerEnvelopeCents: "Racer reference",
  specialShapeEnvelopeCents: "Special-shape reference",
  largeBalloonThresholdCuFt: "Large balloon threshold",
  referenceHours: "Reference hours",
  envelopeAgeCurve: "Age curve",
  conditionMultipliers: "Condition multipliers",
  fabricMultipliers: "Fabric multipliers",
  appearanceDeductions: "Appearance deductions",
  basketNewCents: "Basket reference",
  burnerNewCents: "Burner reference",
  hardwareAgeBands: "Hardware age schedule",
  basketModels: "Basket models",
  burnerModels: "Burner models",
  tankPrices: "Tank prices",
  accessories: "Accessories",
  features: "Envelope features",
  brandPolicies: "Manufacturer rules",
  agePolicy: "Age policy",
  listingMarkup: "Listing markup",
  marketAdjustment: "Market adjustment",
  manufacturerAdjustments: "Manufacturer adjustments",
  confidenceRanges: "Confidence ranges",
  minVerifiedComparablesForHigh: "High-confidence threshold",
  rounding: "Rounding",
};

function changed(a: ValuationConfig, b: ValuationConfig | undefined): string[] {
  if (!b) return [];
  return Object.keys(SECTION_LABEL).filter((k) => JSON.stringify(a[k as keyof ValuationConfig]) !== JSON.stringify(b[k as keyof ValuationConfig])).map((k) => SECTION_LABEL[k]);
}

export default async function VersionsPage() {
  const versions = await getRepository().listConfigs();
  return (
    <div>
      <h1 className="text-3xl">Pricing versions</h1>
      <p className="mt-2 max-w-2xl text-muted">Every saved change is a new, permanent version. Reports record the version they used so they can be reproduced exactly.</p>
      <Panel className="mt-6">
        <ul className="divide-y divide-line-soft">
          {versions.map((v, i) => {
            const diff = changed(v.snapshot, versions[i + 1]?.snapshot);
            return (
              <li key={v.version} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2">
                    <span className="tabular font-medium">v{v.version}</span>
                    {v.isActive && <Badge tone="sage">Active</Badge>}
                    <span>{v.label}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {new Date(v.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    {v.createdBy ? ` · ${v.createdBy}` : ""}
                    {diff.length ? ` · Changed: ${diff.join(", ")}` : i === versions.length - 1 ? " · Initial version" : " · No setting changes"}
                  </p>
                  {v.notes && <p className="mt-1 text-sm">{v.notes}</p>}
                </div>
                {!v.isActive && <ActivateButton version={v.version} />}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

import { formatUsd } from "@/lib/engine/math";
import type { ConfidenceLevel, Provenance, ValuationInput, ValuationResult } from "@/lib/engine/types";
import { CLASSIFICATION_LABEL } from "@/lib/engine/valuate";

export const SCOPE_LABEL: Record<ValuationInput["scope"], string> = {
  envelope_only: "Envelope only",
  complete_system: "Complete balloon system",
  basket_burner: "Basket and burner system",
  components: "Individual equipment",
};

export const CATEGORY_LABEL: Record<ValuationInput["category"], string> = {
  sport: "Sport",
  commercial: "Commercial",
  racer: "Racer",
  special_shape: "Special shape",
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { high: "High", moderate: "Moderate", low: "Low" };

export const CONFIDENCE_TEXT: Record<ConfidenceLevel, string> = {
  high: "Complete equipment details supported by verified comparable sales.",
  moderate: "Complete equipment details, valued with expert pricing rules.",
  low: "Key information is missing or provisional. Fill in the items flagged below to tighten the range.",
};

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  user_supplied: "Your figure",
  model_reference: "Reference price",
  generic_reference: "Generic estimate",
  calculated: "Calculated",
  provisional: "Provisional",
};

export { CLASSIFICATION_LABEL };

const CONDITION: Record<string, string> = { A: "A: Excellent", B: "B: Good", C: "C: Average", D: "D: Fair", E: "E: Poor" };
const FABRIC: Record<string, string> = { polyester: "Polyester", nylon: "Nylon", hyperlast: "Hyperlast", mixed: "Mixed", unknown: "Unknown" };
const APPEARANCE: Record<string, string> = { warm: "Attractive warm colors", neutral: "Neutral design", unattractive: "Unattractive or non-warm colors" };

export function reportTitle(input: ValuationInput): string {
  const name = [input.scope === "envelope_only" || input.scope === "complete_system" ? input.year : undefined, input.manufacturer === "Other" ? "" : input.manufacturer, input.model]
    .filter(Boolean)
    .join(" ");
  return name || "Balloon equipment";
}

/** Key-value details of what was entered, grouped for the report. */
export function detailSections(input: ValuationInput): { title: string; rows: [string, string][] }[] {
  const out: { title: string; rows: [string, string][] }[] = [];
  const balloon: [string, string][] = [
    ["Valuing", SCOPE_LABEL[input.scope]],
    ["Manufacturer", input.manufacturer],
  ];
  if (input.model) balloon.push(["Model", input.model]);
  if (input.scope === "envelope_only" || input.scope === "complete_system") {
    balloon.push(["Category", CATEGORY_LABEL[input.category]]);
    if (input.volumeCuFt) balloon.push(["Volume", `${input.volumeCuFt.toLocaleString("en-US")} cu ft`]);
    if (input.year) balloon.push(["Envelope year", String(input.year)]);
    if (input.hours !== undefined) balloon.push(["Envelope hours", input.hours.toLocaleString("en-US")]);
  }
  out.push({ title: "Balloon", rows: balloon });

  const e = input.envelope;
  if (e && (input.scope === "envelope_only" || input.scope === "complete_system")) {
    const rows: [string, string][] = [
      ["Fabric", e.fabric === "mixed" && e.fabricMix?.length ? `Mixed: ${e.fabricMix.map((s) => `${s.percent}% ${FABRIC[s.fabric]}`).join(", ")}` : FABRIC[e.fabric]],
      ["Condition", e.condition ? CONDITION[e.condition] : "Not provided (C used provisionally)"],
      ["Appearance", APPEARANCE[e.appearance]],
      ["Heavy commercial branding", e.heavyBranding ? "Yes" : "No"],
    ];
    if (e.features?.length) rows.push(["Features", e.features.map((f) => f.replace(/_/g, " ")).join(", ")]);
    if (e.knownReplacementCostCents) rows.push(["New equivalent envelope", formatUsd(e.knownReplacementCostCents)]);
    if (e.inspection?.lastAnnualDate) rows.push(["Last annual inspection", e.inspection.lastAnnualDate]);
    if (e.inspection?.porosityNote) rows.push(["Porosity", e.inspection.porosityNote]);
    if (e.inspection?.fabricStrengthNote) rows.push(["Fabric strength", e.inspection.fabricStrengthNote]);
    if (e.inspection?.majorRepairs) rows.push(["Major repairs", e.inspection.majorRepairs]);
    out.push({ title: "Envelope", rows });
  }
  if (input.scope !== "envelope_only") {
    const b = input.basket;
    if (b) {
      const rows: [string, string][] = [];
      const name = [b.manufacturer, b.model].filter(Boolean).join(" ");
      if (name) rows.push(["Basket", name]);
      rows.push(["Year", b.year ? String(b.year) : "Not provided"]);
      if (b.dimensions) rows.push(["Dimensions", b.dimensions]);
      if (b.construction) rows.push(["Construction", b.construction === "lightweight" ? "Lightweight" : "Standard"]);
      rows.push(["Condition", b.condition ? CONDITION[b.condition] : "Not provided"]);
      if (b.knownResaleCents !== undefined) rows.push(["Known resale value", formatUsd(b.knownResaleCents)]);
      if (b.customNote) rows.push(["Custom details", b.customNote]);
      out.push({ title: "Basket", rows });
    }
    const br = input.burner;
    if (br) {
      const rows: [string, string][] = [];
      const name = [br.manufacturer, br.model].filter(Boolean).join(" ");
      if (name) rows.push(["Burner", name]);
      if (br.configuration) rows.push(["Configuration", br.configuration.charAt(0).toUpperCase() + br.configuration.slice(1)]);
      rows.push(["Glow", br.glow === "glow" ? "Glow" : br.glow === "non_glow" ? "Non-Glow" : "Not specified"]);
      if (br.year) rows.push(["Year", String(br.year)]);
      if (br.condition) rows.push(["Condition", CONDITION[br.condition]]);
      if (br.knownResaleCents !== undefined) rows.push(["Known resale value", formatUsd(br.knownResaleCents)]);
      out.push({ title: "Burner", rows });
    }
    if (input.tanks?.length) {
      out.push({
        title: "Fuel tanks",
        rows: input.tanks.map((t, i) => [
          `Group ${i + 1}`,
          `${t.quantity} × ${[t.manufacturer, t.material === "unknown" ? "material unknown" : t.material, t.capacity === "other" ? `${t.otherCapacityGallons ?? "other"} gal` : t.capacity ? `${t.capacity} gal` : "capacity not given"].filter(Boolean).join(", ")}`,
        ]),
      });
    }
    if (input.accessories?.length) {
      out.push({ title: "Accessories", rows: input.accessories.map((a) => [a.label || a.key.replace(/_/g, " "), a.valueCents !== undefined ? formatUsd(a.valueCents) : "Reference value"]) });
    }
  }
  return out;
}

export function summaryText(input: ValuationInput, r: ValuationResult, ref: string, url?: string): string {
  const lines = [
    `Balloon Bluebook valuation ${ref}`,
    `${reportTitle(input)} (${SCOPE_LABEL[input.scope].toLowerCase()})`,
    `Estimated fair market value: ${formatUsd(r.fairMarketValueCents)}`,
    `Reasonable selling range: ${formatUsd(r.rangeLowCents)} to ${formatUsd(r.rangeHighCents)}`,
    `Recommended listing price: ${formatUsd(r.listingPriceCents)}${r.listingProvisional ? " (provisional)" : ""}`,
    `Confidence: ${CONFIDENCE_LABEL[r.confidence]}`,
  ];
  if (r.asking) {
    lines.push(
      `Seller asking: ${formatUsd(r.asking.askingCents)}${r.asking.percent !== null ? ` (${r.asking.percent >= 0 ? "+" : ""}${r.asking.percent.toFixed(1)}%, ${CLASSIFICATION_LABEL[r.asking.classification].toLowerCase()})` : ""}`,
    );
  }
  for (const c of r.components) lines.push(`  ${c.label}: ${formatUsd(c.displayCents)}`);
  lines.push(`Valued ${new Date(r.valuationDate).toLocaleDateString("en-US", { dateStyle: "long" })} under pricing configuration v${r.configVersion}.`);
  if (url) lines.push(url);
  lines.push("Estimate only. Not a certified appraisal or airworthiness determination.");
  return lines.join("\n");
}

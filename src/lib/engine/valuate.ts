import { ageDepreciation, bandRemaining, formatUsd, interpolateVolumePrice, pct, roundTo } from "./math";
import type {
  AccessoryInput,
  AskingAnalysis,
  AskingClassification,
  BasketInput,
  BrandPolicy,
  BurnerInput,
  BurnerModelRef,
  CalcStep,
  ComponentResult,
  Condition,
  ConfidenceLevel,
  EnvelopeInput,
  KnownFabric,
  PolicyApplication,
  TankInput,
  ValuationConfig,
  ValuationFlag,
  ValuationInput,
  ValuationResult,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

export interface ValuateOptions {
  /** Valuation date. Defaults to now. The valuation year is always derived from this date, never hardcoded. */
  asOf?: Date;
  /** Number of verified completed sales that support this configuration. Required for High confidence. */
  verifiedComparables?: number;
}

const CONDITION_LABEL: Record<Condition, string> = { A: "Excellent", B: "Good", C: "Average", D: "Fair", E: "Poor" };
const FABRIC_LABEL: Record<KnownFabric | "unknown", string> = {
  polyester: "Polyester",
  nylon: "Nylon",
  hyperlast: "Hyperlast",
  unknown: "Unknown",
};

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function includesEnvelope(scope: ValuationInput["scope"]): boolean {
  return scope === "envelope_only" || scope === "complete_system";
}

export function includesHardware(scope: ValuationInput["scope"]): boolean {
  return scope !== "envelope_only";
}

class FlagList {
  items: ValuationFlag[] = [];
  add(code: string, severity: ValuationFlag["severity"], message: string) {
    if (!this.items.some((f) => f.code === code && f.message === message)) this.items.push({ code, severity, message });
  }
}

function conditionFactor(
  config: ValuationConfig,
  condition: Condition | undefined,
  flags: FlagList,
  part: string,
): { factor: number; label: string } {
  if (!condition) {
    flags.add(`${part}_condition_unknown`, "assumption", `${cap(part)} condition was not provided. Average (C) is used provisionally.`);
    return { factor: config.conditionMultipliers.C, label: "C: Average (provisional)" };
  }
  return { factor: config.conditionMultipliers[condition], label: `${condition}: ${CONDITION_LABEL[condition]}` };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------------------------------------------------------- Envelope */

export function replacementCost(
  input: ValuationInput,
  config: ValuationConfig,
  flags: FlagList,
): { cents: number; label: string; provenance: ComponentResult["provenance"] } {
  const env = input.envelope;
  if (env?.knownReplacementCostCents && env.knownReplacementCostCents > 0) {
    return { cents: env.knownReplacementCostCents, label: "New equivalent envelope price (user supplied)", provenance: "user_supplied" };
  }
  if (input.category === "racer") {
    return { cents: config.racerEnvelopeCents, label: "Racer reference envelope price", provenance: "generic_reference" };
  }
  if (input.category === "special_shape") {
    flags.add(
      "special_shape_reference",
      "assumption",
      `Special shapes vary widely. The ${formatUsd(config.specialShapeEnvelopeCents)} special-shape starting assumption is used. A known replacement cost gives a better estimate.`,
    );
    return { cents: config.specialShapeEnvelopeCents, label: "Special-shape starting assumption", provenance: "generic_reference" };
  }
  const volume = input.volumeCuFt;
  if (!volume || volume <= 0) {
    flags.add("volume_missing", "critical", "Envelope volume is missing. Enter the volume or a known replacement cost.");
    return { cents: 0, label: "Volume not provided", provenance: "generic_reference" };
  }
  const mfrPoints = config.manufacturerEnvelopePrices.find((m) => norm(m.manufacturer) === norm(input.manufacturer))?.points;
  const points = mfrPoints && mfrPoints.length > 0 ? mfrPoints : config.envelopePrices;
  const result = interpolateVolumePrice(points, volume);
  const sorted = [...points].sort((a, b) => a.volumeCuFt - b.volumeCuFt);
  const range = `${sorted[0].volumeCuFt.toLocaleString("en-US")} to ${sorted[sorted.length - 1].volumeCuFt.toLocaleString("en-US")} cu ft`;
  if (result.extrapolated) {
    if (volume > config.largeBalloonThresholdCuFt) {
      flags.add(
        "volume_large_unsupported",
        "critical",
        `${volume.toLocaleString("en-US")} cu ft is well beyond the reference range (${range}). The replacement cost is an extrapolation. Enter a known replacement cost for a reliable estimate.`,
      );
    } else {
      flags.add(
        "volume_extrapolated",
        "critical",
        `${volume.toLocaleString("en-US")} cu ft is outside the reference range (${range}). The replacement cost is extrapolated from the nearest references.`,
      );
    }
  }
  return {
    cents: result.priceCents,
    label: `${mfrPoints ? `${input.manufacturer} ` : ""}reference price for ${volume.toLocaleString("en-US")} cu ft${result.extrapolated ? " (extrapolated)" : result.priceCents && !sorted.some((p) => p.volumeCuFt === volume) ? " (interpolated)" : ""}`,
    provenance: result.extrapolated ? "provisional" : "generic_reference",
  };
}

export function fabricFactor(env: EnvelopeInput, config: ValuationConfig, flags: FlagList): { factor: number; label: string } {
  const m = config.fabricMultipliers;
  if (env.fabric === "polyester" || env.fabric === "nylon" || env.fabric === "hyperlast") {
    return { factor: m[env.fabric], label: FABRIC_LABEL[env.fabric] };
  }
  if (env.fabric === "unknown") {
    flags.add("fabric_unknown", "assumption", "Fabric type is unknown. No fabric adjustment is applied.");
    return { factor: m.unknown, label: "Unknown (no adjustment)" };
  }
  // Mixed fabric: weighted only when every share is a known fabric and shares total 100%.
  const mix = (env.fabricMix ?? []).filter((s) => s.percent > 0);
  const total = mix.reduce((n, s) => n + s.percent, 0);
  const allKnown = mix.length > 0 && mix.every((s) => s.fabric !== "unknown");
  if (allKnown && Math.abs(total - 100) < 0.5) {
    const factor = mix.reduce((n, s) => n + (m[s.fabric as KnownFabric] * s.percent) / 100, 0);
    const label = `Mixed: ${mix.map((s) => `${s.percent}% ${FABRIC_LABEL[s.fabric as KnownFabric]}`).join(", ")} (weighted)`;
    return { factor, label };
  }
  flags.add(
    "fabric_mixed_partial",
    "assumption",
    "Mixed fabric without a complete known breakdown. A neutral fabric factor (1.00) is used pending full percentages.",
  );
  const known = mix.filter((s) => s.fabric !== "unknown").map((s) => `${s.percent}% ${FABRIC_LABEL[s.fabric as KnownFabric]}`);
  return { factor: 1, label: `Mixed${known.length ? `: ${known.join(", ")}, remainder unspecified` : ""} (neutral)` };
}

export function appearanceDeduction(env: EnvelopeInput, config: ValuationConfig): { deduction: number; label: string } {
  const a = config.appearanceDeductions;
  const colorDed = env.appearance === "unattractive" ? a.unattractive : env.appearance === "neutral" ? a.neutral : a.warm;
  const brandDed = env.heavyBranding ? a.heavyBranding : 0;
  const deduction = Math.min(a.maxCombined, Math.max(colorDed, brandDed));
  const parts: string[] = [];
  parts.push(env.appearance === "warm" ? "Attractive warm colors" : env.appearance === "neutral" ? "Neutral design" : "Unattractive or non-warm colors");
  if (env.heavyBranding) parts.push("heavy commercial branding");
  const both = colorDed > 0 && brandDed > 0;
  return { deduction, label: `${parts.join(", ")}${both ? " (single maximum deduction, not stacked)" : ""}` };
}

function valueEnvelope(
  input: ValuationInput,
  config: ValuationConfig,
  valuationYear: number,
  flags: FlagList,
): { component: ComponentResult; age: number | null; hoursConsumed: number | null; ageDep: number | null } {
  const env: EnvelopeInput = input.envelope ?? { fabric: "unknown", appearance: "neutral", heavyBranding: false };
  const steps: CalcStep[] = [];
  const rc = replacementCost(input, config, flags);
  let v = rc.cents;
  steps.push({ label: rc.label, kind: rc.provenance === "user_supplied" ? "override" : "base", valueCents: v });

  // Hours
  const refHours = config.referenceHours[input.category];
  let hoursConsumed: number | null = null;
  if (input.hours === undefined || input.hours === null || Number.isNaN(input.hours)) {
    flags.add("hours_missing", "critical", "Envelope hours are missing. Hours have a large effect on value.");
  } else {
    hoursConsumed = input.hours / refHours;
    const factor = Math.max(0, 1 - hoursConsumed);
    v *= factor;
    steps.push({
      label: "Flight-hour depreciation",
      kind: "multiply",
      factor,
      valueCents: v,
      detail: `${input.hours.toLocaleString("en-US")} of ${refHours} reference hours used (${pct(Math.min(1, hoursConsumed), 1)}). Economic reference life, not a service-life limit.`,
    });
  }

  // Age
  let age: number | null = null;
  let ageDep: number | null = null;
  if (!input.year) {
    flags.add("year_missing", "critical", "Envelope year of manufacture is missing.");
  } else {
    age = Math.max(0, valuationYear - input.year);
    if (input.year > valuationYear) flags.add("year_future", "critical", "Year of manufacture is later than the valuation year.");
    ageDep = ageDepreciation(config.envelopeAgeCurve, age);
    v *= 1 - ageDep;
    steps.push({
      label: "Age depreciation",
      kind: "multiply",
      factor: 1 - ageDep,
      valueCents: v,
      detail: `${age} year${age === 1 ? "" : "s"} old in ${valuationYear}: ${pct(ageDep, 1)} depreciation`,
    });
  }

  // Condition
  const cond = conditionFactor(config, env.condition, flags, "envelope");
  v *= cond.factor;
  steps.push({ label: "Envelope condition", kind: "multiply", factor: cond.factor, valueCents: v, detail: cond.label });

  // Fabric
  const fab = fabricFactor(env, config, flags);
  v *= fab.factor;
  steps.push({ label: "Fabric adjustment", kind: "multiply", factor: fab.factor, valueCents: v, detail: fab.label });

  // Appearance
  const app = appearanceDeduction(env, config);
  v *= 1 - app.deduction;
  steps.push({ label: "Appearance adjustment", kind: "multiply", factor: 1 - app.deduction, valueCents: v, detail: app.label });

  // Features: recorded, priced only when the administrator configured a value
  const features = env.features ?? [];
  for (const key of features) {
    const ref = config.features.find((f) => f.key === key);
    if (ref?.adjustmentCents) {
      v += ref.adjustmentCents;
      steps.push({ label: `${ref.label}`, kind: "add", valueCents: v, detail: "Administrator-configured feature value" });
    }
  }
  const unpriced = features.filter((k) => !config.features.find((f) => f.key === k)?.adjustmentCents);
  if (unpriced.length) {
    const labels = unpriced.map((k) => config.features.find((f) => f.key === k)?.label ?? k).join(", ");
    steps.push({ label: "Recorded features", kind: "info", valueCents: v, detail: `${labels}: recorded, no price adjustment configured` });
  }

  if (env.inspection?.lastAnnualDate) {
    flags.add(
      "inspection_note",
      "info",
      "An annual inspection date was recorded. It does not establish condition or airworthiness on its own.",
    );
  }
  if (env.inspection?.majorRepairs) {
    flags.add("major_repairs", "info", "Major repairs were reported. Review repair records with any buyer or inspector.");
  }

  v = Math.max(0, v);
  return {
    component: {
      kind: "envelope",
      label: "Envelope",
      valueCents: v,
      displayCents: roundTo(v, config.rounding.componentCents),
      provenance: rc.provenance === "user_supplied" ? "calculated" : rc.provenance === "provisional" ? "provisional" : "calculated",
      steps,
    },
    age,
    hoursConsumed,
    ageDep,
  };
}

/* ---------------------------------------------------------------- Hardware */

function provisionalHardwareAge(
  part: "basket" | "burner",
  year: number | undefined,
  envelopeYear: number | undefined,
  valuationYear: number,
  config: ValuationConfig,
  flags: FlagList,
): { age: number; provisional: boolean; detail: string } {
  if (year) {
    const age = Math.max(0, valuationYear - year);
    return { age, provisional: false, detail: `${age} year${age === 1 ? "" : "s"} old (${year})` };
  }
  if (envelopeYear) {
    const age = Math.max(0, valuationYear - envelopeYear);
    flags.add(
      `${part}_year_assumed`,
      "assumption",
      `${cap(part)} year of manufacture was not provided. The envelope year (${envelopeYear}) is used provisionally. Enter the ${part} year for a reliable estimate.`,
    );
    return { age, provisional: true, detail: `${age} years (provisional, envelope year ${envelopeYear} assumed)` };
  }
  const oldest = Math.max(...config.hardwareAgeBands.map((b) => b.minAge));
  flags.add(
    `${part}_year_unknown`,
    "critical",
    `${cap(part)} year of manufacture was not provided. The oldest age band is used provisionally.`,
  );
  return { age: oldest, provisional: true, detail: `${oldest}+ years (provisional, year unknown)` };
}

function valueBasket(
  basket: BasketInput,
  config: ValuationConfig,
  valuationYear: number,
  envelopeYear: number | undefined,
  flags: FlagList,
): ComponentResult {
  const label = ["Basket", [basket.manufacturer, basket.model].filter(Boolean).join(" ")].filter(Boolean).join(": ");
  if (basket.knownResaleCents !== undefined && basket.knownResaleCents >= 0) {
    const v = basket.knownResaleCents;
    return {
      kind: "basket",
      label,
      valueCents: v,
      displayCents: roundTo(v, config.rounding.componentCents),
      provenance: "user_supplied",
      steps: [{ label: "Known used-market value (user supplied)", kind: "override", valueCents: v, detail: "Used directly. Not depreciated again." }],
    };
  }
  const steps: CalcStep[] = [];
  const model = basket.modelId ? config.basketModels.find((b) => b.id === basket.modelId) : undefined;
  let v: number;
  if (model?.newPriceCents) {
    v = model.newPriceCents;
    steps.push({ label: `${model.manufacturer} ${model.model} new-equivalent reference`, kind: "base", valueCents: v });
  } else {
    v = config.basketNewCents;
    steps.push({
      label: "Generic basket new-equivalent reference",
      kind: "base",
      valueCents: v,
      detail: "Provisional allocation of the basket-and-burner reference",
    });
  }
  const age = provisionalHardwareAge("basket", basket.year, envelopeYear, valuationYear, config, flags);
  const remaining = bandRemaining(config.hardwareAgeBands, age.age);
  v *= remaining;
  steps.push({ label: "Basket age schedule", kind: "multiply", factor: remaining, valueCents: v, detail: age.detail });
  const cond = conditionFactor(config, basket.condition, flags, "basket");
  v *= cond.factor;
  steps.push({ label: "Basket condition", kind: "multiply", factor: cond.factor, valueCents: v, detail: cond.label });
  if (basket.customNote) {
    steps.push({ label: "Custom details recorded", kind: "info", valueCents: v, detail: "No automatic premium for cosmetic customization" });
  }
  return {
    kind: "basket",
    label,
    valueCents: v,
    displayCents: roundTo(v, config.rounding.componentCents),
    provenance: age.provisional ? "provisional" : model?.newPriceCents ? "model_reference" : "generic_reference",
    steps,
  };
}

export function matchBurnerModel(burner: BurnerInput, config: ValuationConfig): { model?: BurnerModelRef; glowAssumed: boolean } {
  const candidates = burner.modelId
    ? (() => {
        const picked = config.burnerModels.find((b) => b.id === burner.modelId);
        if (!picked) return [];
        return config.burnerModels.filter(
          (b) => norm(b.manufacturer) === norm(picked.manufacturer) && norm(b.model) === norm(picked.model),
        );
      })()
    : config.burnerModels.filter(
        (b) => norm(b.manufacturer) === norm(burner.manufacturer) && norm(b.model) === norm(burner.model) && norm(b.model) !== "",
      );
  if (candidates.length === 0) return { glowAssumed: false };
  if (burner.glow === "glow" || burner.glow === "non_glow") {
    const exact = candidates.find((c) => c.glow === burner.glow) ?? candidates.find((c) => c.glow === "any");
    return { model: exact, glowAssumed: false };
  }
  // Glow capability unknown
  const any = candidates.find((c) => c.glow === "any");
  if (any) return { model: any, glowAssumed: false };
  const nonGlow = candidates.find((c) => c.glow === "non_glow");
  return { model: nonGlow, glowAssumed: Boolean(nonGlow) };
}

function valueBurner(
  burner: BurnerInput,
  config: ValuationConfig,
  valuationYear: number,
  envelopeYear: number | undefined,
  flags: FlagList,
): ComponentResult {
  const name = [burner.manufacturer, burner.model].filter(Boolean).join(" ");
  const glowText = burner.glow === "glow" ? "Glow" : burner.glow === "non_glow" ? "non-Glow" : "";
  const label = ["Burner", [name, glowText].filter(Boolean).join(", ")].filter(Boolean).join(": ");
  if (burner.knownResaleCents !== undefined && burner.knownResaleCents >= 0) {
    const v = burner.knownResaleCents;
    return {
      kind: "burner",
      label,
      valueCents: v,
      displayCents: roundTo(v, config.rounding.componentCents),
      provenance: "user_supplied",
      steps: [{ label: "Known used-market value (user supplied)", kind: "override", valueCents: v, detail: "Used directly. Not depreciated again." }],
    };
  }
  const { model, glowAssumed } = matchBurnerModel(burner, config);
  if (model && model.usedValueCents !== null) {
    let v = model.usedValueCents;
    const steps: CalcStep[] = [
      {
        label: `${model.manufacturer} ${model.model}${model.glow === "non_glow" ? " (non-Glow)" : model.glow === "glow" ? " (Glow)" : ""} used-market reference`,
        kind: "base",
        valueCents: v,
        detail: "Used-market value. No age depreciation applied.",
      },
    ];
    if (glowAssumed) {
      flags.add("burner_glow_assumed", "assumption", "Glow capability was not specified. The non-Glow reference price is used provisionally.");
    }
    if (burner.condition) {
      const cond = conditionFactor(config, burner.condition, flags, "burner");
      v *= cond.factor;
      steps.push({ label: "Burner condition", kind: "multiply", factor: cond.factor, valueCents: v, detail: cond.label });
    }
    return {
      kind: "burner",
      label,
      valueCents: v,
      displayCents: roundTo(v, config.rounding.componentCents),
      provenance: glowAssumed ? "provisional" : "model_reference",
      steps,
    };
  }
  // Generic estimate
  if (model && model.usedValueCents === null) {
    flags.add(
      "burner_model_unpriced",
      "assumption",
      `No verified used price is configured for ${model.manufacturer} ${model.model}${model.glow === "glow" ? " (Glow)" : ""}. A generic burner estimate is used.`,
    );
  } else {
    flags.add("burner_generic", "assumption", `${name || "This burner"} is not in the burner reference list. A generic burner estimate is used.`);
  }
  const steps: CalcStep[] = [];
  let v = config.burnerNewCents;
  steps.push({ label: "Generic burner new-equivalent reference", kind: "base", valueCents: v, detail: "Clearly identified generic estimate" });
  const age = provisionalHardwareAge("burner", burner.year, envelopeYear, valuationYear, config, flags);
  const remaining = bandRemaining(config.hardwareAgeBands, age.age);
  v *= remaining;
  steps.push({ label: "Burner age schedule", kind: "multiply", factor: remaining, valueCents: v, detail: age.detail });
  const cond = conditionFactor(config, burner.condition, flags, "burner");
  v *= cond.factor;
  steps.push({ label: "Burner condition", kind: "multiply", factor: cond.factor, valueCents: v, detail: cond.label });
  return {
    kind: "burner",
    label,
    valueCents: v,
    displayCents: roundTo(v, config.rounding.componentCents),
    provenance: age.provisional ? "provisional" : "generic_reference",
    steps,
  };
}

export function steelPrice(config: ValuationConfig, capacity?: string): number | null {
  if (capacity === "10" || capacity === "15" || capacity === "20") return config.tankPrices.steel[capacity];
  return null;
}

function valueTanks(tanks: TankInput[], config: ValuationConfig, flags: FlagList): ComponentResult | null {
  const valid = tanks.filter((t) => t.quantity > 0);
  if (valid.length === 0) return null;
  const lines: NonNullable<ComponentResult["lines"]> = [];
  const steps: CalcStep[] = [];
  let total = 0;
  let altMin = 0;
  let altMax = 0;
  let hasUnknown = false;
  let provisional = false;
  for (const t of valid) {
    const capText = t.capacity === "other" ? `${t.otherCapacityGallons ? `${t.otherCapacityGallons} gal` : "other capacity"}` : t.capacity ? `${t.capacity} gal` : "capacity not given";
    const name = `${t.quantity} × ${[t.manufacturer, t.material === "unknown" ? "material unknown" : t.material, capText].filter(Boolean).join(" ")}`;
    let each: number;
    let note: string;
    if (t.knownValueEachCents !== undefined && t.knownValueEachCents >= 0) {
      each = t.knownValueEachCents;
      note = "Known value (user supplied)";
      altMin += each * t.quantity;
      altMax += each * t.quantity;
    } else if (t.material === "aluminum") {
      each = config.tankPrices.aluminumCents;
      note = `Aluminum used-market reference, ${formatUsd(each)} each`;
      altMin += each * t.quantity;
      altMax += each * t.quantity;
    } else if (t.material === "steel") {
      const p = steelPrice(config, t.capacity);
      if (p === null) {
        each = 0;
        provisional = true;
        note = "No steel reference for this capacity. Enter a known value.";
        flags.add("tank_steel_capacity", "critical", "A steel tank has a capacity without a reference price. Enter a known value for it.");
      } else {
        each = p;
        note = `Steel ${t.capacity} gal used-market reference, ${formatUsd(p)} each`;
      }
      altMin += each * t.quantity;
      altMax += each * t.quantity;
    } else {
      hasUnknown = true;
      provisional = true;
      each = config.tankPrices.aluminumCents;
      const steel = steelPrice(config, t.capacity);
      const steelMin = steel ?? Math.min(...Object.values(config.tankPrices.steel));
      const steelMax = steel ?? Math.max(...Object.values(config.tankPrices.steel));
      altMin += steelMin * t.quantity;
      altMax += steelMax * t.quantity;
      note = `Material unknown. Counted at the aluminum value (${formatUsd(each)} each) until identified.`;
      flags.add(
        "tank_material_unknown",
        "critical",
        `Tank material is unknown${t.manufacturer ? ` for the ${t.manufacturer} tanks` : ""}. Identify aluminum or steel. The estimate counts them as aluminum; as steel they would be worth ${
          steel ? formatUsd(steel) : `${formatUsd(steelMin)} to ${formatUsd(steelMax)}`
        } each.`,
      );
    }
    const lineValue = each * t.quantity;
    total += lineValue;
    lines.push({ label: name, valueCents: lineValue, displayCents: roundTo(lineValue, config.rounding.componentCents), note });
    steps.push({ label: name, kind: "add", valueCents: total, detail: note });
  }
  return {
    kind: "tanks",
    label: "Fuel tanks",
    valueCents: total,
    displayCents: roundTo(total, config.rounding.componentCents),
    provenance: provisional ? "provisional" : "model_reference",
    steps,
    lines,
    conditionalAlternativeCents: hasUnknown ? { label: "If unidentified tanks are steel", minCents: altMin, maxCents: altMax } : undefined,
  };
}

function valueAccessories(accessories: AccessoryInput[], config: ValuationConfig, flags: FlagList): ComponentResult | null {
  if (accessories.length === 0) return null;
  const lines: NonNullable<ComponentResult["lines"]> = [];
  const steps: CalcStep[] = [];
  let total = 0;
  let anyUser = false;
  for (const a of accessories) {
    const ref = config.accessories.find((r) => r.key === a.key);
    const name = a.label?.trim() || ref?.label || a.key;
    let v = 0;
    let note: string;
    if (a.valueCents !== undefined && a.valueCents >= 0) {
      v = a.valueCents;
      note = "Estimated resale value (user supplied)";
      anyUser = true;
    } else if (ref?.usedValueCents !== null && ref?.usedValueCents !== undefined) {
      v = ref.usedValueCents;
      note = "Used-market reference";
    } else {
      note = "No reference value configured. Enter an estimate to include it.";
      flags.add(`accessory_unpriced_${a.key}`, "info", `${name} has no reference value and is counted at $0. Enter an estimate to include it.`);
    }
    total += v;
    lines.push({ label: name, valueCents: v, displayCents: roundTo(v, config.rounding.componentCents), note });
    steps.push({ label: name, kind: "add", valueCents: total, detail: note });
  }
  return {
    kind: "accessories",
    label: "Accessories",
    valueCents: total,
    displayCents: roundTo(total, config.rounding.componentCents),
    provenance: anyUser ? "user_supplied" : "model_reference",
    steps,
    lines,
  };
}

/* ---------------------------------------------------------------- Asking price */

export function classifyAsking(percent: number): AskingClassification {
  if (percent < -15) return "bargain";
  if (percent < 15) return "within";
  if (percent < 30) return "overpriced";
  return "significantly_overpriced";
}

export const CLASSIFICATION_LABEL: Record<AskingClassification, string> = {
  bargain: "Potential bargain",
  within: "Within pricing tolerance",
  overpriced: "Overpriced",
  significantly_overpriced: "Significantly overpriced",
  not_applicable: "Not comparable",
};

export function analyzeAsking(
  askingCents: number,
  fairValueCents: number,
  rangeLowCents: number,
  listingCents: number,
): AskingAnalysis {
  const differenceCents = askingCents - fairValueCents;
  if (fairValueCents <= 0) {
    return {
      askingCents,
      fairValueCents,
      differenceCents,
      percent: null,
      classification: "not_applicable",
      negotiationLowCents: 0,
      negotiationHighCents: 0,
      message:
        "The estimated resale value is $0 under the applicable policy, so the asking price cannot be compared as a percentage. Any amount paid reflects component, salvage, or personal value.",
    };
  }
  const percent = (askingCents / fairValueCents - 1) * 100;
  const classification = classifyAsking(percent);
  const negotiationLowCents = rangeLowCents;
  const negotiationHighCents = Math.max(fairValueCents, Math.min(askingCents, listingCents));
  const messages: Record<AskingClassification, string> = {
    bargain: "The asking price is well below the estimated fair value. Confirm equipment details and condition before relying on the difference.",
    within: "The asking price is within the normal tolerance around the estimated fair value.",
    overpriced: "The asking price is above the estimated fair value. There may be room to negotiate, or the seller may have details this estimate does not capture.",
    significantly_overpriced:
      "The asking price is well above the estimated fair value. Ask the seller what supports the price, such as recent inspections, upgrades, or equipment not entered here.",
    not_applicable: "",
  };
  return {
    askingCents,
    fairValueCents,
    differenceCents,
    percent,
    classification,
    negotiationLowCents,
    negotiationHighCents,
    message: messages[classification],
  };
}

/* ---------------------------------------------------------------- Main */

function matchingPolicies(manufacturer: string, config: ValuationConfig): BrandPolicy[] {
  const m = norm(manufacturer);
  return config.brandPolicies.filter((p) => p.active && (norm(p.manufacturer) === m || (p.aliases ?? []).some((a) => norm(a) === m)));
}

export function valuate(input: ValuationInput, config: ValuationConfig, options: ValuateOptions = {}): ValuationResult {
  const asOf = options.asOf ?? new Date();
  const valuationYear = asOf.getFullYear();
  const flags = new FlagList();
  const components: ComponentResult[] = [];

  let envelopeAge: number | null = null;
  let hoursConsumed: number | null = null;
  let ageDep: number | null = null;

  const withEnvelope = includesEnvelope(input.scope);
  const withHardware = includesHardware(input.scope);

  if (withEnvelope) {
    const env = valueEnvelope(input, config, valuationYear, flags);
    components.push(env.component);
    envelopeAge = env.age;
    hoursConsumed = env.hoursConsumed;
    ageDep = env.ageDep;
  }

  if (withHardware) {
    const envYear = input.year;
    if (input.basket) components.push(valueBasket(input.basket, config, valuationYear, envYear, flags));
    if (input.burner) components.push(valueBurner(input.burner, config, valuationYear, envYear, flags));
    const tanks = valueTanks(input.tanks ?? [], config, flags);
    if (tanks) components.push(tanks);
    const acc = valueAccessories(input.accessories ?? [], config, flags);
    if (acc) components.push(acc);
  }

  if (components.length === 0) {
    flags.add("nothing_to_value", "critical", "No components were entered for this valuation.");
  }

  // Raw total and market adjustment (step 12-13)
  const rawTotal = components.reduce((n, c) => n + c.valueCents, 0);
  const mfrAdj = config.manufacturerAdjustments[input.manufacturer] ?? 1;
  const marketFactor = (1 + config.marketAdjustment) * mfrAdj;
  let total = rawTotal * marketFactor;
  const adjustedTotal = total;

  // Policies (step 14). Applied whenever the envelope is part of the valuation.
  const policies: PolicyApplication[] = [];
  let legacyMessage: string | null = null;
  let brandMessage: string | null = null;
  let policyMax: number | null = null;
  let zeroed = false;

  if (withEnvelope) {
    const ap = config.agePolicy;
    if (envelopeAge !== null && envelopeAge > ap.legacyAfterAge) {
      zeroed = true;
      legacyMessage =
        "This balloon falls into the legacy category. Under Balloon Bluebook's standard resale policy, the complete system has no recommended resale value. Gifting or donating the balloon may be more appropriate.";
      policies.push({
        code: "legacy_zero",
        message: `Envelope is ${envelopeAge} years old, beyond the ${ap.legacyAfterAge}-year legacy threshold. This is a commercial valuation policy, not a regulatory or airworthiness determination.`,
        rawTotalCents: total,
        cappedTotalCents: 0,
        policyMaxCents: 0,
      });
    } else if (envelopeAge !== null && envelopeAge >= ap.capStartAge && envelopeAge <= ap.capEndAge) {
      const capped = Math.min(total, ap.capMaxCents);
      policyMax = policyMax === null ? ap.capMaxCents : Math.min(policyMax, ap.capMaxCents);
      policies.push({
        code: "age_cap",
        message: `Envelope is ${envelopeAge} years old. Systems aged ${ap.capStartAge} to ${ap.capEndAge} years are capped at ${formatUsd(ap.capMaxCents)}.${
          total > ap.capMaxCents ? ` The calculated total of ${formatUsd(roundTo(total, config.rounding.totalCents))} was reduced to the cap.` : " The calculated total is already below the cap."
        }`,
        rawTotalCents: total,
        cappedTotalCents: capped,
        policyMaxCents: ap.capMaxCents,
      });
      total = capped;
    }

    for (const policy of matchingPolicies(input.manufacturer, config)) {
      if (policy.kind === "zero") {
        zeroed = true;
        brandMessage = policy.message ?? `${policy.manufacturer} systems carry a $0 standard resale recommendation.`;
        policies.push({
          code: "brand_zero",
          message: `${policy.manufacturer} resale policy: ${brandMessage} This is a commercial valuation preference, not a statement about airworthiness.`,
          rawTotalCents: total,
          cappedTotalCents: 0,
          policyMaxCents: 0,
        });
      } else if (policy.kind === "cap" && policy.maxValueCents !== undefined) {
        const before = total;
        const capped = Math.min(total, policy.maxValueCents);
        policyMax = policyMax === null ? policy.maxValueCents : Math.min(policyMax, policy.maxValueCents);
        const typical =
          policy.typicalMinCents !== undefined && policy.typicalMaxCents !== undefined
            ? ` Typical ${policy.manufacturer} systems sell for ${formatUsd(policy.typicalMinCents)} to ${formatUsd(policy.typicalMaxCents)}.`
            : "";
        let explain = "";
        if (policy.typicalMinCents !== undefined && policy.typicalMaxCents !== undefined) {
          if (capped > policy.typicalMaxCents) {
            explain = ` This estimate sits above the typical range because the entered equipment, age, and hours calculate to more than a typical system.`;
          } else if (capped < policy.typicalMinCents) {
            explain = ` This estimate sits below the typical range because of the entered age, hours, condition, or missing equipment.`;
          }
        }
        brandMessage = `${policy.manufacturer} complete-system resale is capped at ${formatUsd(policy.maxValueCents)}.${typical}${explain}`;
        policies.push({
          code: "brand_cap",
          message: `${brandMessage}${before > policy.maxValueCents ? ` The calculated total of ${formatUsd(roundTo(before, config.rounding.totalCents))} was reduced to the cap.` : ""}`,
          rawTotalCents: before,
          cappedTotalCents: capped,
          policyMaxCents: policy.maxValueCents,
        });
        total = capped;
      }
    }
  }

  if (zeroed) total = 0;

  const hardwareTotal = components.filter((c) => c.kind !== "envelope").reduce((n, c) => n + c.valueCents, 0);
  const separateComponentValueCents = zeroed && hardwareTotal > 0 ? roundTo(hardwareTotal, config.rounding.componentCents) : null;

  // Final values (steps 15-17)
  let fmv = roundTo(total, config.rounding.totalCents);
  if (policyMax !== null) fmv = Math.min(fmv, policyMax);

  const critical = flags.items.some((f) => f.severity === "critical");
  const confidence: ConfidenceLevel = critical
    ? "low"
    : (options.verifiedComparables ?? 0) >= config.minVerifiedComparablesForHigh
      ? "high"
      : "moderate";
  const rangePct = config.confidenceRanges[confidence];
  let rangeLow = roundTo(fmv * (1 - rangePct), config.rounding.totalCents);
  let rangeHigh = roundTo(fmv * (1 + rangePct), config.rounding.totalCents);
  if (policyMax !== null) rangeHigh = Math.min(rangeHigh, policyMax);
  if (fmv === 0) {
    rangeLow = 0;
    rangeHigh = 0;
  }

  let listing = fmv > 0 ? roundTo(fmv * (1 + config.listingMarkup), config.rounding.listingCents) : 0;
  if (policyMax !== null) listing = Math.min(listing, policyMax);

  const asking =
    input.askingPriceCents !== undefined && input.askingPriceCents > 0
      ? analyzeAsking(input.askingPriceCents, fmv, rangeLow, listing)
      : null;

  return {
    engineVersion: ENGINE_VERSION,
    configVersion: config.version,
    valuationDate: asOf.toISOString(),
    valuationYear,
    scope: input.scope,
    envelopeAge,
    hoursConsumedPct: hoursConsumed,
    ageDepreciationPct: ageDep,
    components,
    rawTotalCents: rawTotal,
    marketAdjustmentFactor: marketFactor,
    adjustedTotalCents: adjustedTotal,
    policies,
    separateComponentValueCents,
    fairMarketValueCents: fmv,
    rangeLowCents: rangeLow,
    rangeHighCents: rangeHigh,
    listingPriceCents: listing,
    listingProvisional: confidence === "low" && fmv > 0,
    confidence,
    confidenceRangePct: rangePct,
    flags: flags.items,
    asking,
    legacyMessage,
    brandMessage,
  };
}

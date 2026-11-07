import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../defaults";
import type { ValuationInput } from "../types";
import { valuate } from "../valuate";

/**
 * Historical calibration references from the specification, recalculated under the
 * default configuration with a fixed valuation date so expectations are deterministic.
 * The historical estimates came from an earlier model and are not forced here.
 */
const AS_OF = new Date("2026-06-15T12:00:00Z");
const $ = (dollars: number) => Math.round(dollars * 100);
const comp = (r: ReturnType<typeof valuate>, kind: string) => r.components.find((c) => c.kind === kind);

export const caseA: ValuationInput = {
  manufacturer: "Cameron",
  model: "O-90",
  volumeCuFt: 90000,
  year: 2003,
  hours: 150,
  category: "sport",
  scope: "complete_system",
  envelope: { fabric: "nylon", condition: "B", appearance: "warm", heavyBranding: false },
  basket: { manufacturer: "Aristocrat", model: "42 × 52", year: 2003, dimensions: "42 x 52" },
  burner: { manufacturer: "Cameron", model: "Super Doubles", modelId: "burner-cameron-super-doubles", glow: "unknown" },
  tanks: [{ manufacturer: "Worthington", material: "aluminum", capacity: "10", quantity: 4 }],
};

export const caseB: ValuationInput = {
  manufacturer: "Aerostar",
  model: "RX-7",
  volumeCuFt: 77000,
  year: 2007,
  hours: 106.56,
  category: "sport",
  scope: "complete_system",
  envelope: { fabric: "nylon", condition: "A", appearance: "warm", heavyBranding: false },
  basket: { manufacturer: "Aerostar", model: "RWSW-AFX", modelId: "basket-aerostar-rwsw-afx" },
  burner: { manufacturer: "Aerostar", model: "Zone V Double", modelId: "burner-aerostar-zone-v-double-nonglow", glow: "non_glow" },
  tanks: [{ material: "aluminum", quantity: 2 }],
};

export const caseC: ValuationInput = {
  manufacturer: "Cameron",
  model: "C-80",
  volumeCuFt: 80000,
  year: 2008,
  hours: 285,
  category: "sport",
  scope: "envelope_only",
  envelope: {
    fabric: "mixed",
    fabricMix: [{ fabric: "hyperlast", percent: 25 }],
    appearance: "warm",
    heavyBranding: false,
  },
};

const caseDEnvelope = {
  manufacturer: "Other",
  model: "Racer",
  year: 2023,
  hours: 100,
  category: "racer" as const,
  envelope: { fabric: "unknown" as const, condition: "A" as const, appearance: "warm" as const, heavyBranding: false, knownReplacementCostCents: $(23000) },
};

export const caseDEnvelopeOnly: ValuationInput = { ...caseDEnvelope, scope: "envelope_only", askingPriceCents: $(19000) };
export const caseDComplete: ValuationInput = {
  ...caseDEnvelope,
  scope: "complete_system",
  basket: { manufacturer: "Kubicek", model: "K13s", modelId: "basket-kubicek-k13s", construction: "lightweight" },
  burner: { manufacturer: "Ignis", model: "Plus Double", modelId: "burner-ignis-plus-double", glow: "unknown", configuration: "double" },
  tanks: [{ manufacturer: "Prince", material: "unknown", quantity: 2 }],
  askingPriceCents: $(39000),
};

describe("Case A: Cameron O-90 (2003, 150 h, nylon, B)", () => {
  const r = valuate(caseA, DEFAULT_CONFIG, { asOf: AS_OF });

  it("applies accelerated age depreciation for a 23-year-old envelope", () => {
    expect(r.envelopeAge).toBe(23);
    expect(r.ageDepreciationPct).toBeCloseTo(0.55, 10);
    // 22,000 x 0.75 hours x 0.45 age x 1.05 condition B x 0.95 nylon
    expect(comp(r, "envelope")!.valueCents).toBeCloseTo(740643.75, 6);
    expect(comp(r, "envelope")!.displayCents).toBe($(7400));
  });

  it("values hardware independently", () => {
    expect(comp(r, "basket")!.valueCents).toBe($(3200));
    expect(comp(r, "burner")!.valueCents).toBe($(2200));
    expect(comp(r, "tanks")!.valueCents).toBe($(1000));
    expect(r.components.find((c) => c.kind === "accessories")).toBeUndefined();
  });

  it("produces the recalculated fair market value, range and listing price", () => {
    expect(r.rawTotalCents).toBeCloseTo(1380643.75, 6);
    expect(r.fairMarketValueCents).toBe($(13800));
    expect(r.confidence).toBe("moderate");
    expect(r.rangeLowCents).toBe($(11750));
    expect(r.rangeHighCents).toBe($(15850));
    expect(r.listingPriceCents).toBe($(14900));
    // Lower than the historical $15,800 estimate because of accelerated depreciation after 20 years
    expect(r.fairMarketValueCents).toBeLessThan($(15800));
  });
});

describe("Case B: Aerostar RX-7 (2007, 106.56 h, nylon, A)", () => {
  const r = valuate(caseB, DEFAULT_CONFIG, { asOf: AS_OF });

  it("interpolates the 19-year age depreciation", () => {
    expect(r.envelopeAge).toBe(19);
    expect(r.ageDepreciationPct).toBeCloseTo(0.38, 10);
    // 18,000 x (1 - 106.56/600) x 0.62 x 1.10 x 0.95
    expect(comp(r, "envelope")!.valueCents).toBeCloseTo(18000 * 100 * (1 - 106.56 / 600) * 0.62 * 1.1 * 0.95, 6);
  });

  it("uses the non-Glow Zone V reference without depreciating it", () => {
    expect(comp(r, "burner")!.valueCents).toBe($(1800));
    expect(comp(r, "burner")!.provenance).toBe("model_reference");
  });

  it("labels the basket year as provisional", () => {
    expect(comp(r, "basket")!.provenance).toBe("provisional");
    expect(r.flags.some((f) => f.code === "basket_year_assumed")).toBe(true);
    expect(comp(r, "basket")!.valueCents).toBe($(3200));
  });

  it("totals the system", () => {
    expect(comp(r, "tanks")!.valueCents).toBe($(500));
    expect(r.fairMarketValueCents).toBe($(15100));
  });
});

describe("Case C: Cameron C-80 envelope only (2008, 285 h, one-quarter Hyperlast)", () => {
  const r = valuate(caseC, DEFAULT_CONFIG, { asOf: AS_OF });

  it("adds no hardware", () => {
    expect(r.components.map((c) => c.kind)).toEqual(["envelope"]);
  });

  it("interpolates the 80,000 cu ft replacement price and applies no Hyperlast penalty", () => {
    const repl = 1800000 + (3000 / 13000) * 400000;
    expect(comp(r, "envelope")!.steps[0].valueCents).toBeCloseTo(repl, 6);
    const fabricStep = comp(r, "envelope")!.steps.find((s) => s.label === "Fabric adjustment")!;
    expect(fabricStep.factor).toBe(1);
    expect(comp(r, "envelope")!.valueCents).toBeCloseTo(repl * 0.525 * 0.64, 6);
    expect(r.fairMarketValueCents).toBe($(6350));
  });
});

describe("Case D: modern racer", () => {
  it("values the envelope alone and compares the $19,000 envelope asking price", () => {
    const r = valuate(caseDEnvelopeOnly, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.envelopeAge).toBe(3);
    // 23,000 known replacement x (1 - 100/400) x 0.94 x 1.10
    expect(comp(r, "envelope")!.valueCents).toBeCloseTo($(17836.5), 6);
    expect(r.fairMarketValueCents).toBe($(17850));
    expect(r.asking!.percent).toBeCloseTo((19000 / 17850 - 1) * 100, 6);
    expect(r.asking!.classification).toBe("within");
  });

  it("values the complete system separately and flags every unknown", () => {
    const r = valuate(caseDComplete, DEFAULT_CONFIG, { asOf: AS_OF });
    const codes = r.flags.map((f) => f.code);
    expect(codes).toContain("tank_material_unknown");
    expect(codes).toContain("basket_year_assumed");
    expect(codes).toContain("burner_year_assumed");
    expect(codes).toContain("burner_model_unpriced");
    // Prince tanks are not assumed to be steel: counted at the aluminum value with a steel alternative shown
    expect(comp(r, "tanks")!.valueCents).toBe($(500));
    expect(comp(r, "tanks")!.conditionalAlternativeCents).toEqual({ label: "If unidentified tanks are steel", minCents: $(2000), maxCents: $(3700) });
    expect(comp(r, "basket")!.valueCents).toBe($(6800));
    expect(comp(r, "burner")!.valueCents).toBe($(6800));
    expect(r.fairMarketValueCents).toBe($(31950));
    expect(r.confidence).toBe("low");
    expect(r.listingProvisional).toBe(true);
    expect(r.asking!.classification).toBe("overpriced");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../defaults";
import { ageDepreciation, bandRemaining, interpolateVolumePrice, roundTo } from "../math";
import { valuationInputSchema } from "../schema";
import type { ValuationConfig, ValuationInput } from "../types";
import { analyzeAsking, classifyAsking, valuate } from "../valuate";

const AS_OF = new Date("2026-06-15T12:00:00Z");
const $ = (dollars: number) => Math.round(dollars * 100);
const cfg = (patch: Partial<ValuationConfig> = {}): ValuationConfig => ({ ...structuredClone(DEFAULT_CONFIG), ...patch });

const envelopeBase: ValuationInput = {
  manufacturer: "Cameron",
  volumeCuFt: 90000,
  year: 2021,
  hours: 0,
  category: "sport",
  scope: "envelope_only",
  envelope: { fabric: "polyester", condition: "C", appearance: "warm", heavyBranding: false },
};
const hardware = (patch: Partial<ValuationInput>): ValuationInput => ({
  manufacturer: "Cameron",
  category: "sport",
  scope: "components",
  ...patch,
});
const env = (r: ReturnType<typeof valuate>) => r.components.find((c) => c.kind === "envelope")!;
const kind = (r: ReturnType<typeof valuate>, k: string) => r.components.find((c) => c.kind === k);

describe("fuel tanks", () => {
  it("prices aluminum tanks at $250 regardless of capacity or manufacturer", () => {
    for (const capacity of ["10", "15", "20", "other", undefined] as const) {
      const r = valuate(hardware({ tanks: [{ manufacturer: "Worthington", material: "aluminum", capacity, quantity: 1 }] }), DEFAULT_CONFIG, { asOf: AS_OF });
      expect(kind(r, "tanks")!.valueCents).toBe($(250));
    }
  });

  it("prices steel tanks by capacity", () => {
    const steel = (capacity: "10" | "15" | "20") =>
      kind(valuate(hardware({ tanks: [{ material: "steel", capacity, quantity: 1 }] }), DEFAULT_CONFIG, { asOf: AS_OF }), "tanks")!.valueCents;
    expect(steel("10")).toBe($(1000));
    expect(steel("15")).toBe($(1500));
    expect(steel("20")).toBe($(1850));
  });

  it("multiplies by quantity", () => {
    const r = valuate(
      hardware({
        tanks: [
          { manufacturer: "Worthington", material: "aluminum", quantity: 4 },
          { material: "steel", capacity: "15", quantity: 2 },
          { material: "steel", capacity: "20", quantity: 2 },
        ],
      }),
      DEFAULT_CONFIG,
      { asOf: AS_OF },
    );
    expect(kind(r, "tanks")!.lines!.map((l) => l.valueCents)).toEqual([$(1000), $(3000), $(3700)]);
    expect(kind(r, "tanks")!.valueCents).toBe($(7700));
  });

  it("never depreciates tank reference prices", () => {
    const r = valuate(
      { ...envelopeBase, year: 1999, scope: "complete_system", tanks: [{ material: "steel", capacity: "20", quantity: 1 }] },
      DEFAULT_CONFIG,
      { asOf: AS_OF },
    );
    expect(kind(r, "tanks")!.valueCents).toBe($(1850));
  });

  it("handles unknown material with a conditional estimate instead of inventing the material", () => {
    const r = valuate(hardware({ tanks: [{ manufacturer: "Prince", material: "unknown", capacity: "15", quantity: 2 }] }), DEFAULT_CONFIG, { asOf: AS_OF });
    const t = kind(r, "tanks")!;
    expect(t.valueCents).toBe($(500));
    expect(t.provenance).toBe("provisional");
    expect(t.conditionalAlternativeCents).toMatchObject({ minCents: $(3000), maxCents: $(3000) });
    expect(r.flags.find((f) => f.code === "tank_material_unknown")?.severity).toBe("critical");
    expect(r.confidence).toBe("low");
  });

  it("uses a known value override per tank", () => {
    const r = valuate(hardware({ tanks: [{ material: "steel", capacity: "10", quantity: 3, knownValueEachCents: $(700) }] }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(r, "tanks")!.valueCents).toBe($(2100));
  });

  it("does not guess a price for steel tanks of other capacity", () => {
    const r = valuate(hardware({ tanks: [{ material: "steel", capacity: "other", otherCapacityGallons: 12, quantity: 1 }] }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(r, "tanks")!.valueCents).toBe(0);
    expect(r.flags.some((f) => f.code === "tank_steel_capacity")).toBe(true);
  });
});

describe("burners", () => {
  it("uses model references and known overrides without double depreciation", () => {
    const old = { year: 1995, condition: undefined };
    const cam = valuate(hardware({ burner: { manufacturer: "Cameron", model: "Super Doubles", glow: "non_glow", ...old } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(cam, "burner")!.valueCents).toBe($(2200));
    const known = valuate(hardware({ burner: { glow: "unknown", year: 1990, condition: "E", knownResaleCents: $(1234) } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(known, "burner")!.valueCents).toBe($(1234));
    expect(kind(known, "burner")!.provenance).toBe("user_supplied");
  });

  it("matches the Zone V non-Glow reference only for non-Glow burners", () => {
    const nonGlow = valuate(hardware({ burner: { manufacturer: "Aerostar", model: "Zone V Double", glow: "non_glow", year: 2010 } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(nonGlow, "burner")!.valueCents).toBe($(1800));
    const glow = valuate(hardware({ burner: { manufacturer: "Aerostar", model: "Zone V Double", glow: "glow", year: 2010 } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(glow, "burner")!.valueCents).not.toBe($(1800));
    // Glow entry has no verified price: generic $8,000 x 0.55 (16 years old falls in the 16+ band, 40% remaining)
    expect(kind(glow, "burner")!.valueCents).toBe($(8000 * 0.4));
    expect(glow.flags.some((f) => f.code === "burner_model_unpriced")).toBe(true);
  });

  it("uses a clearly identified generic estimate for unknown models", () => {
    const r = valuate(hardware({ burner: { manufacturer: "Mystery", model: "X1", glow: "unknown", year: 2022, condition: "B" } }), DEFAULT_CONFIG, { asOf: AS_OF });
    // 4 years old -> 85% band, condition B 1.05
    expect(kind(r, "burner")!.valueCents).toBeCloseTo($(8000) * 0.85 * 1.05, 6);
    expect(r.flags.some((f) => f.code === "burner_generic")).toBe(true);
  });

  it("applies a burner condition multiplier to a model reference only when condition is given", () => {
    const r = valuate(hardware({ burner: { manufacturer: "Cameron", model: "Super Doubles", glow: "unknown", condition: "D" } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(r, "burner")!.valueCents).toBeCloseTo($(2200) * 0.9, 6);
  });
});

describe("baskets", () => {
  it("follows the basket age bands then condition", () => {
    const value = (year: number, condition?: "A" | "E") =>
      kind(valuate(hardware({ basket: { year, condition } }), DEFAULT_CONFIG, { asOf: AS_OF }), "basket")!.valueCents;
    expect(value(2025)).toBe($(8000));
    expect(value(2024)).toBe($(8000));
    expect(value(2023)).toBe($(6800));
    expect(value(2018)).toBe($(5600));
    expect(value(2013)).toBeCloseTo($(4400), 6);
    expect(value(2010)).toBe($(3200));
    expect(value(2010, "A")).toBeCloseTo($(3200) * 1.1, 6);
    expect(value(2010, "E")).toBe($(2400));
  });

  it("uses a known resale value directly", () => {
    const r = valuate(hardware({ basket: { year: 1990, condition: "E", knownResaleCents: $(4100) } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(r, "basket")!.valueCents).toBe($(4100));
  });

  it("calculates basket age independently of envelope age", () => {
    const r = valuate(
      { ...envelopeBase, year: 2004, scope: "complete_system", basket: { year: 2024, condition: "C" } },
      DEFAULT_CONFIG,
      { asOf: AS_OF },
    );
    expect(r.envelopeAge).toBe(22);
    expect(kind(r, "basket")!.valueCents).toBe($(8000));
  });
});

describe("envelope adjustments", () => {
  it("applies nylon -5% and no Hyperlast penalty, and does not boost polyester", () => {
    const base = env(valuate(envelopeBase, DEFAULT_CONFIG, { asOf: AS_OF })).valueCents;
    const nylon = env(valuate({ ...envelopeBase, envelope: { ...envelopeBase.envelope!, fabric: "nylon" } }, DEFAULT_CONFIG, { asOf: AS_OF })).valueCents;
    const hyper = env(valuate({ ...envelopeBase, envelope: { ...envelopeBase.envelope!, fabric: "hyperlast" } }, DEFAULT_CONFIG, { asOf: AS_OF })).valueCents;
    expect(nylon / base).toBeCloseTo(0.95, 10);
    expect(hyper).toBe(base);
    // Polyester 1.00: $22,000 x 0.95 age (5 years -> 10%? no: 2026-2021 = 5 -> 10%)
    expect(base).toBeCloseTo($(22000) * 0.9, 6);
  });

  it("weights mixed fabric only when the full breakdown is known", () => {
    const mixed = (fabricMix: { fabric: "nylon" | "hyperlast" | "polyester" | "unknown"; percent: number }[]) =>
      valuate({ ...envelopeBase, envelope: { ...envelopeBase.envelope!, fabric: "mixed", fabricMix } }, DEFAULT_CONFIG, { asOf: AS_OF });
    const weighted = mixed([{ fabric: "hyperlast", percent: 25 }, { fabric: "nylon", percent: 75 }]);
    expect(env(weighted).steps.find((s) => s.label === "Fabric adjustment")!.factor).toBeCloseTo(0.9625, 10);
    const partial = mixed([{ fabric: "hyperlast", percent: 25 }]);
    expect(env(partial).steps.find((s) => s.label === "Fabric adjustment")!.factor).toBe(1);
    expect(partial.flags.some((f) => f.code === "fabric_mixed_partial")).toBe(true);
  });

  it("caps appearance and branding at a single 20% deduction", () => {
    const value = (appearance: "warm" | "neutral" | "unattractive", heavyBranding: boolean) =>
      env(valuate({ ...envelopeBase, envelope: { ...envelopeBase.envelope!, appearance, heavyBranding } }, DEFAULT_CONFIG, { asOf: AS_OF })).valueCents;
    const base = value("warm", false);
    expect(value("neutral", false)).toBe(base);
    expect(value("unattractive", false) / base).toBeCloseTo(0.8, 10);
    expect(value("warm", true) / base).toBeCloseTo(0.8, 10);
    expect(value("unattractive", true) / base).toBeCloseTo(0.8, 10);
  });

  it("applies appearance only to the envelope", () => {
    const sys = (heavyBranding: boolean) =>
      valuate(
        { ...envelopeBase, scope: "complete_system", envelope: { ...envelopeBase.envelope!, heavyBranding }, basket: { year: 2021 }, tanks: [{ material: "aluminum", quantity: 2 }] },
        DEFAULT_CONFIG,
        { asOf: AS_OF },
      );
    expect(kind(sys(true), "basket")!.valueCents).toBe(kind(sys(false), "basket")!.valueCents);
    expect(kind(sys(true), "tanks")!.valueCents).toBe(kind(sys(false), "tanks")!.valueCents);
  });

  it("applies condition multipliers per component, not as a blanket factor", () => {
    const r = valuate(
      { ...envelopeBase, scope: "complete_system", envelope: { ...envelopeBase.envelope!, condition: "A" }, basket: { year: 2021, condition: "E" } },
      DEFAULT_CONFIG,
      { asOf: AS_OF },
    );
    expect(env(r).valueCents).toBeCloseTo($(22000) * 0.9 * 1.1, 6);
    expect(kind(r, "basket")!.valueCents).toBeCloseTo($(8000) * 0.85 * 0.75, 6);
  });

  it("discloses provisional condition C when condition is unknown", () => {
    const r = valuate({ ...envelopeBase, envelope: { ...envelopeBase.envelope!, condition: undefined } }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(env(r).steps.find((s) => s.label === "Envelope condition")!.factor).toBe(1);
    expect(r.flags.some((f) => f.code === "envelope_condition_unknown")).toBe(true);
  });

  it("never produces a negative envelope value past the reference hours", () => {
    const r = valuate({ ...envelopeBase, hours: 900 }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(env(r).valueCents).toBe(0);
    expect(r.fairMarketValueCents).toBe(0);
    expect(r.listingPriceCents).toBe(0);
  });

  it("uses category reference hours", () => {
    const racer = valuate({ ...envelopeBase, category: "racer", hours: 100 }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(racer.hoursConsumedPct).toBeCloseTo(0.25, 10);
    const shape = valuate({ ...envelopeBase, category: "special_shape", hours: 90 }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(shape.hoursConsumedPct).toBeCloseTo(0.2, 10);
  });

  it("records features without arbitrary premiums, and applies admin-configured ones", () => {
    const input = { ...envelopeBase, envelope: { ...envelopeBase.envelope!, features: ["parachute_top" as const, "turning_vents" as const] } };
    const plain = valuate(envelopeBase, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(env(valuate(input, DEFAULT_CONFIG, { asOf: AS_OF })).valueCents).toBe(env(plain).valueCents);
    const priced = cfg();
    priced.features = priced.features.map((f) => (f.key === "turning_vents" ? { ...f, adjustmentCents: $(300) } : f));
    expect(env(valuate(input, priced, { asOf: AS_OF })).valueCents).toBe(env(plain).valueCents + $(300));
  });
});

describe("envelope replacement price", () => {
  it("interpolates linearly between reference volumes", () => {
    expect(interpolateVolumePrice(DEFAULT_CONFIG.envelopePrices, 90000).priceCents).toBe($(22000));
    expect(interpolateVolumePrice(DEFAULT_CONFIG.envelopePrices, 97500).priceCents).toBe($(24000));
    expect(interpolateVolumePrice(DEFAULT_CONFIG.envelopePrices, 80000).priceCents).toBeCloseTo($(18000) + (3000 / 13000) * $(4000), 6);
    expect(interpolateVolumePrice(DEFAULT_CONFIG.envelopePrices, 80000).extrapolated).toBe(false);
  });

  it("labels extrapolation outside the reference range and lowers confidence", () => {
    const small = valuate({ ...envelopeBase, volumeCuFt: 56000 }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(small.flags.some((f) => f.code === "volume_extrapolated")).toBe(true);
    expect(small.confidence).toBe("low");
    const big = valuate({ ...envelopeBase, volumeCuFt: 250000, category: "commercial" }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(big.flags.some((f) => f.code === "volume_large_unsupported")).toBe(true);
  });

  it("prioritizes a user-supplied replacement price", () => {
    const r = valuate({ ...envelopeBase, volumeCuFt: 250000, envelope: { ...envelopeBase.envelope!, knownReplacementCostCents: $(60000) } }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(env(r).steps[0].valueCents).toBe($(60000));
    expect(r.flags.some((f) => f.code.startsWith("volume_"))).toBe(false);
  });

  it("uses racer and special-shape references", () => {
    expect(env(valuate({ ...envelopeBase, category: "racer" }, DEFAULT_CONFIG, { asOf: AS_OF })).steps[0].valueCents).toBe($(20000));
    expect(env(valuate({ ...envelopeBase, category: "special_shape" }, DEFAULT_CONFIG, { asOf: AS_OF })).steps[0].valueCents).toBe($(40000));
  });

  it("uses manufacturer-specific pricing when configured", () => {
    const c = cfg({ manufacturerEnvelopePrices: [{ manufacturer: "Ultramagic", points: [{ volumeCuFt: 90000, priceCents: $(25000) }, { volumeCuFt: 105000, priceCents: $(29000) }] }] });
    expect(env(valuate({ ...envelopeBase, manufacturer: "Ultramagic" }, c, { asOf: AS_OF })).steps[0].valueCents).toBe($(25000));
    expect(env(valuate(envelopeBase, c, { asOf: AS_OF })).steps[0].valueCents).toBe($(22000));
  });
});

describe("age depreciation", () => {
  it("follows the table and interpolates missing ages", () => {
    expect(ageDepreciation(DEFAULT_CONFIG.envelopeAgeCurve, 0)).toBe(0);
    expect(ageDepreciation(DEFAULT_CONFIG.envelopeAgeCurve, 5)).toBeCloseTo(0.1, 10);
    expect(ageDepreciation(DEFAULT_CONFIG.envelopeAgeCurve, 7)).toBeCloseTo(0.14, 10);
    expect(ageDepreciation(DEFAULT_CONFIG.envelopeAgeCurve, 12)).toBeCloseTo(0.24, 10);
    expect(ageDepreciation(DEFAULT_CONFIG.envelopeAgeCurve, 30)).toBeCloseTo(0.9, 10);
  });

  it("accelerates after 20 years: 5 points per year instead of 2", () => {
    const at = (a: number) => ageDepreciation(DEFAULT_CONFIG.envelopeAgeCurve, a);
    expect(at(20) - at(19)).toBeCloseTo(0.02, 10);
    for (let a = 21; a <= 30; a++) expect(at(a) - at(a - 1)).toBeCloseTo(0.05, 10);
  });

  it("matches the hardware band table", () => {
    expect(bandRemaining(DEFAULT_CONFIG.hardwareAgeBands, 2)).toBe(1);
    expect(bandRemaining(DEFAULT_CONFIG.hardwareAgeBands, 3)).toBe(0.85);
    expect(bandRemaining(DEFAULT_CONFIG.hardwareAgeBands, 10)).toBe(0.7);
    expect(bandRemaining(DEFAULT_CONFIG.hardwareAgeBands, 15)).toBe(0.55);
    expect(bandRemaining(DEFAULT_CONFIG.hardwareAgeBands, 40)).toBe(0.4);
  });
});

describe("current-year handling", () => {
  afterEach(() => vi.useRealTimers());

  it("derives age from the valuation date, not a hardcoded year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-03-01T12:00:00Z"));
    const r = valuate(envelopeBase, DEFAULT_CONFIG);
    expect(r.valuationYear).toBe(2030);
    expect(r.envelopeAge).toBe(9);
    vi.setSystemTime(new Date("2027-03-01T12:00:00Z"));
    expect(valuate(envelopeBase, DEFAULT_CONFIG).envelopeAge).toBe(6);
  });
});

describe("age policies", () => {
  const system = (year: number): ValuationInput => ({
    ...envelopeBase,
    year,
    hours: 50,
    scope: "complete_system",
    basket: { year: 2024, condition: "A", knownResaleCents: $(6000) },
    burner: { manufacturer: "Cameron", model: "Super Doubles", glow: "unknown" },
    tanks: [{ material: "steel", capacity: "20", quantity: 4 }],
    accessories: [{ key: "trailer" }, { key: "inflation_fan" }],
  });

  it("caps 31 to 35-year-old complete systems at $4,900", () => {
    for (const year of [1995, 1993, 1991]) {
      const r = valuate(system(year), DEFAULT_CONFIG, { asOf: AS_OF });
      expect(r.rawTotalCents).toBeGreaterThan($(4900));
      expect(r.fairMarketValueCents).toBe($(4900));
      expect(r.listingPriceCents).toBeLessThanOrEqual($(4900));
      expect(r.rangeHighCents).toBeLessThanOrEqual($(4900));
      expect(r.policies[0].code).toBe("age_cap");
    }
  });

  it("does not cap a 30-year-old system", () => {
    const r = valuate(system(1996), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.policies).toHaveLength(0);
    expect(r.fairMarketValueCents).toBeGreaterThan($(4900));
  });

  it("sets over-35 systems to $0 and shows component values separately", () => {
    const r = valuate(system(1990), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.envelopeAge).toBe(36);
    expect(r.fairMarketValueCents).toBe(0);
    expect(r.listingPriceCents).toBe(0);
    expect(r.legacyMessage).toMatch(/legacy category/);
    expect(r.legacyMessage).not.toMatch(/FAA/);
    // basket 6,000 + burner 2,200 + tanks 7,400 + trailer 1,500 + fan 1,100
    expect(r.separateComponentValueCents).toBe($(18200));
  });

  it("does not apply envelope age policies to standalone hardware", () => {
    const r = valuate(hardware({ year: 1980, basket: { year: 1980 }, burner: { glow: "unknown", year: 1980 } }), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.policies).toHaveLength(0);
    expect(r.fairMarketValueCents).toBe($(6400));
  });
});

describe("manufacturer policies", () => {
  const firefly = (hours: number): ValuationInput => ({
    manufacturer: "Firefly",
    volumeCuFt: 90000,
    year: 2016,
    hours,
    category: "sport",
    scope: "complete_system",
    envelope: { fabric: "polyester", condition: "B", appearance: "warm", heavyBranding: false },
    basket: { year: 2016 },
    burner: { glow: "non_glow", year: 2016 },
  });

  it("caps Firefly complete systems at $7,500", () => {
    const r = valuate(firefly(100), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.rawTotalCents).toBeGreaterThan($(7500));
    expect(r.fairMarketValueCents).toBe($(7500));
    expect(r.listingPriceCents).toBe($(7500));
    expect(r.brandMessage).toMatch(/above the typical range/);
  });

  it("explains a Firefly estimate below the typical range", () => {
    const r = valuate({ ...firefly(580), basket: undefined, burner: undefined }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.fairMarketValueCents).toBeLessThan($(4000));
    expect(r.brandMessage).toMatch(/below the typical range/);
  });

  it("recommends gifting Raven systems with $0 resale and no listing markup", () => {
    const r = valuate({ ...firefly(100), manufacturer: "Raven", askingPriceCents: $(3000) }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.fairMarketValueCents).toBe(0);
    expect(r.listingPriceCents).toBe(0);
    expect(r.brandMessage).toMatch(/gifting or donating this legacy Raven system/);
    expect(r.separateComponentValueCents).toBeGreaterThan(0);
    expect(r.asking!.percent).toBeNull();
    expect(r.asking!.classification).toBe("not_applicable");
  });

  it("does not apply the Raven policy to Aerostar", () => {
    const r = valuate({ ...firefly(100), manufacturer: "Aerostar" }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.policies).toHaveLength(0);
  });

  it("supports admin-created manufacturer rules", () => {
    const c = cfg();
    c.brandPolicies = [...c.brandPolicies, { id: "p-bw", manufacturer: "Balloon Works", kind: "cap", maxValueCents: $(6000), active: true }];
    expect(valuate({ ...firefly(100), manufacturer: "Balloon Works" }, c, { asOf: AS_OF }).fairMarketValueCents).toBe($(6000));
  });
});

describe("scopes", () => {
  it("envelope-only valuations add no hardware even if hardware data is present", () => {
    const r = valuate({ ...envelopeBase, basket: { year: 2020 }, tanks: [{ material: "aluminum", quantity: 4 }], accessories: [{ key: "trailer" }] }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.components.map((c) => c.kind)).toEqual(["envelope"]);
  });

  it("values basket-and-burner systems without the envelope", () => {
    const r = valuate(
      { manufacturer: "Cameron", category: "sport", scope: "basket_burner", basket: { year: 2020 }, burner: { manufacturer: "Cameron", model: "Super Doubles", glow: "unknown" } },
      DEFAULT_CONFIG,
      { asOf: AS_OF },
    );
    expect(r.components.map((c) => c.kind)).toEqual(["basket", "burner"]);
    expect(r.fairMarketValueCents).toBe($(5600 + 2200));
  });

  it("adds no accessories unless explicitly selected", () => {
    const r = valuate({ ...envelopeBase, scope: "complete_system" }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.components.some((c) => c.kind === "accessories")).toBe(false);
    const withAcc = valuate({ ...envelopeBase, scope: "complete_system", accessories: [{ key: "trailer" }, { key: "inflation_fan" }, { key: "radios" }] }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(withAcc, "accessories")!.valueCents).toBe($(2600));
    const edited = valuate({ ...envelopeBase, scope: "complete_system", accessories: [{ key: "trailer", valueCents: $(900) }, { key: "radios", valueCents: $(150) }] }, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(kind(edited, "accessories")!.valueCents).toBe($(1050));
  });

  it("returns zero cleanly when nothing is valued", () => {
    const r = valuate(hardware({}), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.fairMarketValueCents).toBe(0);
    expect(r.rangeLowCents).toBe(0);
    expect(r.rangeHighCents).toBe(0);
    expect(r.confidence).toBe("low");
  });
});

describe("asking price", () => {
  it("computes the percentage and classification bands", () => {
    expect(analyzeAsking($(25000), $(18000), $(15300), $(19400)).percent).toBeCloseTo(38.888888, 4);
    expect(classifyAsking(-15.01)).toBe("bargain");
    expect(classifyAsking(-15)).toBe("within");
    expect(classifyAsking(14.99)).toBe("within");
    expect(classifyAsking(15)).toBe("overpriced");
    expect(classifyAsking(29.99)).toBe("overpriced");
    expect(classifyAsking(30)).toBe("significantly_overpriced");
  });

  it("reports dollar difference and a negotiation range", () => {
    const a = analyzeAsking($(25000), $(18000), $(15300), $(19400));
    expect(a.differenceCents).toBe($(7000));
    expect(a.classification).toBe("significantly_overpriced");
    expect(a.negotiationLowCents).toBe($(15300));
    expect(a.negotiationHighCents).toBe($(19400));
  });

  it("avoids division by zero", () => {
    const a = analyzeAsking($(5000), 0, 0, 0);
    expect(a.percent).toBeNull();
    expect(a.classification).toBe("not_applicable");
  });
});

describe("confidence, listing and rounding", () => {
  it("only reaches High with verified comparables", () => {
    expect(valuate(envelopeBase, DEFAULT_CONFIG, { asOf: AS_OF }).confidence).toBe("moderate");
    const high = valuate(envelopeBase, DEFAULT_CONFIG, { asOf: AS_OF, verifiedComparables: 3 });
    expect(high.confidence).toBe("high");
    expect(high.confidenceRangePct).toBe(0.08);
  });

  it("applies the editable 8% listing markup", () => {
    const r = valuate(envelopeBase, DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.fairMarketValueCents).toBe($(19800));
    expect(r.listingPriceCents).toBe($(21400));
    const c = cfg({ listingMarkup: 0.1 });
    expect(valuate(envelopeBase, c, { asOf: AS_OF }).listingPriceCents).toBe($(21800));
  });

  it("applies admin market and manufacturer adjustments before policies", () => {
    const c = cfg({ marketAdjustment: -0.1, manufacturerAdjustments: { Cameron: 1.05 } });
    const r = valuate(envelopeBase, c, { asOf: AS_OF });
    expect(r.marketAdjustmentFactor).toBeCloseTo(0.945, 10);
    expect(r.fairMarketValueCents).toBe(roundTo($(19800) * 0.945, $(50)));
  });

  it("rounds to configured increments while keeping internal precision", () => {
    expect(roundTo($(7406.44), $(50))).toBe($(7400));
    expect(roundTo($(7425), $(50))).toBe($(7450));
    expect(roundTo($(14904), $(100))).toBe($(14900));
    expect(roundTo(-5, 100)).toBe(0);
  });
});

describe("input validation", () => {
  it("requires envelope essentials only when the envelope is valued", () => {
    expect(valuationInputSchema.safeParse({ manufacturer: "Cameron", category: "sport", scope: "envelope_only" }).success).toBe(false);
    expect(valuationInputSchema.safeParse({ manufacturer: "Cameron", category: "sport", scope: "components", tanks: [{ material: "aluminum", quantity: 2 }] }).success).toBe(true);
  });

  it("rejects negative values and silly quantities", () => {
    const bad = { ...envelopeBase, hours: -5 };
    expect(valuationInputSchema.safeParse(bad).success).toBe(false);
    expect(valuationInputSchema.safeParse({ ...envelopeBase, tanks: [{ material: "aluminum", quantity: 0 }] }).success).toBe(false);
  });
});

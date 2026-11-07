import type { BasketModelRef, BurnerModelRef, ValuationConfig } from "./types";

/**
 * Built-in reference updates. Each runs once per configuration: when a stored
 * configuration predates an update, the update is applied as a new pricing version,
 * and recorded in defaultsApplied so an administrator's later edits or deletions stick.
 * Updates only add reference entries; they never set or change prices.
 */
export interface DefaultsUpgrade {
  key: string;
  label: string;
  apply: (c: ValuationConfig) => ValuationConfig;
}

export const FIREFLY_ALIASES = ["Balloon Works", "The Balloon Works", "Firefly/Balloon Works"];

export const FIREFLY_BASKET_SIZES = ["3.9", "4.1", "4.2", "4.3", "4.9", "5.0", "5.1", "6.0"];

export const FIREFLY_BASKETS: BasketModelRef[] = FIREFLY_BASKET_SIZES.map((size) => ({
  id: `basket-firefly-${size.replace(".", "-")}`,
  manufacturer: "Firefly",
  model: `${size} basket`,
  newPriceCents: null,
  note: "Firefly / Balloon Works basket size. No verified price configured yet.",
}));

export const FIREFLY_BURNERS: BurnerModelRef[] = [
  { id: "burner-firefly-mirage", manufacturer: "Firefly", model: "Mirage", glow: "any", usedValueCents: null, note: "Firefly / Balloon Works burner. No verified price configured yet." },
  { id: "burner-firefly-t3", manufacturer: "Firefly", model: "T3", glow: "any", usedValueCents: null, note: "Firefly / Balloon Works burner. No verified price configured yet." },
];

const addMissing = <T extends { id: string }>(list: T[], extra: T[]) => [...list, ...extra.filter((e) => !list.some((x) => x.id === e.id))];

export const DEFAULTS_UPGRADES: DefaultsUpgrade[] = [
  {
    key: "2026-11-firefly-balloon-works",
    label: "Firefly and Balloon Works treated as one company",
    apply: (c) => ({
      ...c,
      brandPolicies: c.brandPolicies.map((p) =>
        p.manufacturer.toLowerCase() === "firefly" ? { ...p, aliases: [...new Set([...(p.aliases ?? []), ...FIREFLY_ALIASES])] } : p,
      ),
    }),
  },
  {
    key: "2026-11-firefly-equipment",
    label: "Added Firefly basket sizes and Mirage and T3 burners",
    apply: (c) => ({ ...c, basketModels: addMissing(c.basketModels, FIREFLY_BASKETS), burnerModels: addMissing(c.burnerModels, FIREFLY_BURNERS) }),
  },
];

/** Returns the configuration with any pending built-in updates applied, and the labels of what changed. */
export function applyDefaultsUpgrades(config: ValuationConfig): { config: ValuationConfig; applied: string[] } {
  const done = new Set(config.defaultsApplied ?? []);
  let next = config;
  const applied: string[] = [];
  for (const u of DEFAULTS_UPGRADES) {
    if (done.has(u.key)) continue;
    next = u.apply(next);
    done.add(u.key);
    applied.push(u.label);
  }
  return applied.length ? { config: { ...next, defaultsApplied: [...done] }, applied } : { config, applied };
}


const d = (dollars: number) => Math.round(dollars * 100);

/**
 * Initial expert pricing assumptions. These are editable administrator settings,
 * not statistically derived market indexes. Every saved change creates a new version.
 */
export const DEFAULT_CONFIG: ValuationConfig = {
  version: 1,
  label: "Initial expert calibration",
  envelopePrices: [
    { volumeCuFt: 77000, priceCents: d(18000) },
    { volumeCuFt: 90000, priceCents: d(22000) },
    { volumeCuFt: 105000, priceCents: d(26000) },
    { volumeCuFt: 120000, priceCents: d(31000) },
  ],
  manufacturerEnvelopePrices: [],
  racerEnvelopeCents: d(20000),
  specialShapeEnvelopeCents: d(40000),
  largeBalloonThresholdCuFt: 150000,
  referenceHours: { sport: 600, commercial: 600, racer: 400, special_shape: 450 },
  envelopeAgeCurve: [
    { age: 0, depreciation: 0 },
    { age: 1, depreciation: 0.02 },
    { age: 2, depreciation: 0.04 },
    { age: 3, depreciation: 0.06 },
    { age: 4, depreciation: 0.08 },
    { age: 5, depreciation: 0.1 },
    { age: 10, depreciation: 0.2 },
    { age: 15, depreciation: 0.3 },
    { age: 20, depreciation: 0.4 },
    { age: 21, depreciation: 0.45 },
    { age: 22, depreciation: 0.5 },
    { age: 23, depreciation: 0.55 },
    { age: 24, depreciation: 0.6 },
    { age: 25, depreciation: 0.65 },
    { age: 26, depreciation: 0.7 },
    { age: 27, depreciation: 0.75 },
    { age: 28, depreciation: 0.8 },
    { age: 29, depreciation: 0.85 },
    { age: 30, depreciation: 0.9 },
  ],
  conditionMultipliers: { A: 1.1, B: 1.05, C: 1.0, D: 0.9, E: 0.75 },
  fabricMultipliers: { polyester: 1.0, nylon: 0.95, hyperlast: 1.0, unknown: 1.0 },
  appearanceDeductions: { warm: 0, neutral: 0, unattractive: 0.2, heavyBranding: 0.2, maxCombined: 0.2 },
  basketNewCents: d(8000),
  burnerNewCents: d(8000),
  hardwareAgeBands: [
    { minAge: 0, remaining: 1.0 },
    { minAge: 3, remaining: 0.85 },
    { minAge: 6, remaining: 0.7 },
    { minAge: 11, remaining: 0.55 },
    { minAge: 16, remaining: 0.4 },
  ],
  basketModels: [
    { id: "basket-aristocrat", manufacturer: "Aristocrat", model: "Aristocrat basket", newPriceCents: null },
    { id: "basket-aerostar-rwsw-afx", manufacturer: "Aerostar", model: "RWSW-AFX", newPriceCents: null },
    { id: "basket-kubicek-k13s", manufacturer: "Kubicek", model: "K13s", construction: "lightweight", newPriceCents: null },
    { id: "basket-cameron-cb", manufacturer: "Cameron", model: "Cameron basket", newPriceCents: null },
    { id: "basket-ultramagic", manufacturer: "Ultramagic", model: "Ultramagic basket", newPriceCents: null },
    { id: "basket-lindstrand", manufacturer: "Lindstrand", model: "Lindstrand basket", newPriceCents: null },
    ...FIREFLY_BASKETS,
  ],
  burnerModels: [
    {
      id: "burner-cameron-super-doubles",
      manufacturer: "Cameron",
      model: "Super Doubles",
      configuration: "double",
      glow: "any",
      usedValueCents: d(2200),
      note: "Initial expert used-market assumption",
    },
    {
      id: "burner-aerostar-zone-v-double-nonglow",
      manufacturer: "Aerostar",
      model: "Zone V Double",
      configuration: "double",
      glow: "non_glow",
      usedValueCents: d(1800),
      note: "Initial expert used-market assumption, non-Glow",
    },
    {
      id: "burner-aerostar-zone-v-double-glow",
      manufacturer: "Aerostar",
      model: "Zone V Double",
      configuration: "double",
      glow: "glow",
      usedValueCents: null,
      note: "Glow configuration. No verified price configured yet.",
    },
    { id: "burner-ignis-plus-double", manufacturer: "Ignis", model: "Plus Double", configuration: "double", glow: "any", usedValueCents: null },
    { id: "burner-ultramagic-mk21-double", manufacturer: "Ultramagic", model: "MK-21 Double", configuration: "double", glow: "any", usedValueCents: null },
    { id: "burner-kubicek-double", manufacturer: "Kubicek", model: "Double", configuration: "double", glow: "any", usedValueCents: null },
    { id: "burner-lindstrand-jetstream-double", manufacturer: "Lindstrand", model: "Jetstream Double", configuration: "double", glow: "any", usedValueCents: null },
    ...FIREFLY_BURNERS,
  ],
  tankPrices: {
    aluminumCents: d(250),
    steel: { "10": d(1000), "15": d(1500), "20": d(1850) },
  },
  accessories: [
    { key: "inflation_fan", label: "Inflation fan", usedValueCents: d(1100) },
    { key: "trailer", label: "Trailer", usedValueCents: d(1500) },
    { key: "radios", label: "Radios", usedValueCents: null },
    { key: "gps", label: "GPS", usedValueCents: null },
    { key: "instruments", label: "Instruments", usedValueCents: null },
    { key: "inflation_mat", label: "Inflation mat", usedValueCents: null },
    { key: "quick_release", label: "Quick release", usedValueCents: null },
    { key: "spare_parts", label: "Spare parts", usedValueCents: null },
    { key: "other", label: "Other", usedValueCents: null },
  ],
  features: [
    { key: "parachute_top", label: "Parachute top", adjustmentCents: null },
    { key: "spring_top", label: "Spring top", adjustmentCents: null },
    { key: "paralite_top", label: "Paralite top", adjustmentCents: null },
    { key: "turning_vents", label: "Turning vents or rotators", adjustmentCents: null },
    { key: "racing_scoop", label: "Racing scoop", adjustmentCents: null },
    { key: "nomex_scoop", label: "Nomex scoop", adjustmentCents: null },
    { key: "additional_nomex", label: "Additional Nomex panels", adjustmentCents: null },
    { key: "other", label: "Other", adjustmentCents: null },
  ],
  brandPolicies: [
    {
      id: "policy-firefly",
      manufacturer: "Firefly",
      aliases: FIREFLY_ALIASES,
      kind: "cap",
      maxValueCents: d(7500),
      typicalMinCents: d(4000),
      typicalMaxCents: d(5000),
      message: "Firefly systems typically resell for $4,000 to $5,000, with a recommended maximum of $7,500.",
      active: true,
    },
    {
      id: "policy-raven",
      manufacturer: "Raven",
      kind: "zero",
      message: "Balloon Bluebook recommends gifting or donating this legacy Raven system rather than marketing it as a standard used balloon.",
      active: true,
    },
  ],
  agePolicy: { capStartAge: 31, capEndAge: 35, capMaxCents: d(4900), legacyAfterAge: 35 },
  listingMarkup: 0.08,
  marketAdjustment: 0,
  manufacturerAdjustments: {},
  confidenceRanges: { high: 0.08, moderate: 0.15, low: 0.25 },
  minVerifiedComparablesForHigh: 3,
  rounding: { componentCents: d(50), totalCents: d(50), listingCents: d(100) },
  defaultsApplied: DEFAULTS_UPGRADES.map((u) => u.key),
};

export const MANUFACTURERS = [
  "Cameron",
  "Aerostar",
  "Lindstrand",
  "Ultramagic",
  "Kubicek",
  "Firefly",
  "Raven",
  "Thunder & Colt",
  "Balloon Works",
  "Adams",
  "Schroeder",
  "Other",
] as const;

export const COMMON_VOLUMES = [42000, 56000, 65000, 69000, 77000, 80000, 90000, 105000, 120000, 140000, 160000, 180000, 210000, 250000, 300000];

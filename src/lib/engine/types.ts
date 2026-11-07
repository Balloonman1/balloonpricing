/**
 * Balloon Bluebook valuation engine types.
 *
 * Every monetary value in configuration and output is an integer number of US cents.
 * Calculations keep full floating precision internally and round only at the end.
 */

export type Condition = "A" | "B" | "C" | "D" | "E";
export type BalloonCategory = "sport" | "commercial" | "racer" | "special_shape";
export type ValuationScope = "envelope_only" | "complete_system" | "basket_burner" | "components";
export type Fabric = "polyester" | "nylon" | "hyperlast" | "mixed" | "unknown";
export type KnownFabric = "polyester" | "nylon" | "hyperlast";
export type Appearance = "warm" | "neutral" | "unattractive";
export type TankMaterial = "aluminum" | "steel" | "unknown";
export type TankCapacity = "10" | "15" | "20" | "other";
export type BurnerConfiguration = "single" | "double" | "triple";
export type GlowCapability = "glow" | "non_glow" | "unknown";
export type ConfidenceLevel = "high" | "moderate" | "low";

export const ACCESSORY_KEYS = [
  "inflation_fan",
  "trailer",
  "radios",
  "gps",
  "instruments",
  "inflation_mat",
  "quick_release",
  "spare_parts",
  "other",
] as const;
export type AccessoryKey = (typeof ACCESSORY_KEYS)[number];

export const ENVELOPE_FEATURE_KEYS = [
  "parachute_top",
  "spring_top",
  "paralite_top",
  "turning_vents",
  "racing_scoop",
  "nomex_scoop",
  "additional_nomex",
  "other",
] as const;
export type EnvelopeFeatureKey = (typeof ENVELOPE_FEATURE_KEYS)[number];

/* ----------------------------------------------------------------------------
 * Inputs
 * ------------------------------------------------------------------------- */

export interface FabricShare {
  fabric: KnownFabric | "unknown";
  percent: number;
}

export interface EnvelopeInput {
  fabric: Fabric;
  /** Only used when fabric = mixed. */
  fabricMix?: FabricShare[];
  /** Omit when the user does not know. Provisional condition C is used and disclosed. */
  condition?: Condition;
  appearance: Appearance;
  heavyBranding: boolean;
  features?: EnvelopeFeatureKey[];
  otherFeatureNote?: string;
  /** User-supplied price of a brand-new equivalent envelope today. Overrides generic references. */
  knownReplacementCostCents?: number;
  inspection?: {
    lastAnnualDate?: string;
    porosityNote?: string;
    fabricStrengthNote?: string;
    majorRepairs?: string;
  };
}

export interface BasketInput {
  manufacturer?: string;
  model?: string;
  year?: number;
  dimensions?: string;
  condition?: Condition;
  construction?: "lightweight" | "standard";
  customNote?: string;
  /** Known used-market value. Used directly, never depreciated again. */
  knownResaleCents?: number;
  /** Optional reference to a configured basket model. */
  modelId?: string;
}

export interface BurnerInput {
  manufacturer?: string;
  model?: string;
  modelId?: string;
  configuration?: BurnerConfiguration;
  glow: GlowCapability;
  year?: number;
  condition?: Condition;
  /** Known used-market value. Used directly, never depreciated again. */
  knownResaleCents?: number;
}

export interface TankInput {
  manufacturer?: string;
  material: TankMaterial;
  capacity?: TankCapacity;
  otherCapacityGallons?: number;
  quantity: number;
  knownValueEachCents?: number;
}

export interface AccessoryInput {
  key: AccessoryKey;
  label?: string;
  /** User-edited resale value. When omitted the configured reference value is used. */
  valueCents?: number;
}

export interface ValuationInput {
  manufacturer: string;
  model?: string;
  volumeCuFt?: number;
  year?: number;
  hours?: number;
  category: BalloonCategory;
  scope: ValuationScope;
  envelope?: EnvelopeInput;
  basket?: BasketInput;
  burner?: BurnerInput;
  tanks?: TankInput[];
  accessories?: AccessoryInput[];
  askingPriceCents?: number;
}

/* ----------------------------------------------------------------------------
 * Configuration (admin editable, versioned)
 * ------------------------------------------------------------------------- */

export interface VolumePricePoint {
  volumeCuFt: number;
  priceCents: number;
}

export interface AgePoint {
  age: number;
  /** Depreciation as a fraction 0..1 */
  depreciation: number;
}

export interface AgeBand {
  /** Inclusive lower bound in years. Bands are matched by the highest minAge <= age. */
  minAge: number;
  /** Remaining value as a fraction 0..1 */
  remaining: number;
}

export interface BurnerModelRef {
  id: string;
  manufacturer: string;
  model: string;
  configuration?: BurnerConfiguration;
  /** "any" applies regardless of glow capability. */
  glow: "glow" | "non_glow" | "any";
  /** Used-market value. Null when no verified price is configured yet. */
  usedValueCents: number | null;
  note?: string;
}

export interface BasketModelRef {
  id: string;
  manufacturer: string;
  model: string;
  construction?: "lightweight" | "standard";
  /** New-equivalent reference price. Null means the generic basket reference is used. */
  newPriceCents: number | null;
  note?: string;
}

export interface AccessoryRef {
  key: AccessoryKey;
  label: string;
  /** Used-market value. Null when no reference is configured. */
  usedValueCents: number | null;
}

export interface FeatureRef {
  key: EnvelopeFeatureKey;
  label: string;
  /** Only applied when configured by an administrator. */
  adjustmentCents: number | null;
}

export interface BrandPolicy {
  id: string;
  manufacturer: string;
  /** Other names for the same company, e.g. Balloon Works for Firefly. */
  aliases?: string[];
  kind: "cap" | "zero";
  maxValueCents?: number;
  typicalMinCents?: number;
  typicalMaxCents?: number;
  message?: string;
  active: boolean;
}

export interface ManufacturerEnvelopePricing {
  manufacturer: string;
  points: VolumePricePoint[];
}

export interface ValuationConfig {
  version: number;
  label?: string;
  envelopePrices: VolumePricePoint[];
  manufacturerEnvelopePrices: ManufacturerEnvelopePricing[];
  racerEnvelopeCents: number;
  specialShapeEnvelopeCents: number;
  /** Volumes beyond this multiple of the largest reference are flagged as requiring a known replacement cost. */
  largeBalloonThresholdCuFt: number;
  referenceHours: Record<BalloonCategory, number>;
  envelopeAgeCurve: AgePoint[];
  conditionMultipliers: Record<Condition, number>;
  fabricMultipliers: Record<KnownFabric | "unknown", number>;
  appearanceDeductions: { warm: number; neutral: number; unattractive: number; heavyBranding: number; maxCombined: number };
  basketNewCents: number;
  burnerNewCents: number;
  hardwareAgeBands: AgeBand[];
  basketModels: BasketModelRef[];
  burnerModels: BurnerModelRef[];
  tankPrices: {
    aluminumCents: number;
    steel: { "10": number; "15": number; "20": number };
  };
  accessories: AccessoryRef[];
  features: FeatureRef[];
  brandPolicies: BrandPolicy[];
  agePolicy: {
    capStartAge: number;
    capEndAge: number;
    capMaxCents: number;
    legacyAfterAge: number;
  };
  listingMarkup: number;
  marketAdjustment: number;
  manufacturerAdjustments: Record<string, number>;
  confidenceRanges: Record<ConfidenceLevel, number>;
  minVerifiedComparablesForHigh: number;
  rounding: { componentCents: number; totalCents: number; listingCents: number };
  /** Keys of built-in reference updates already applied to this configuration. */
  defaultsApplied?: string[];
}

/* ----------------------------------------------------------------------------
 * Output
 * ------------------------------------------------------------------------- */

export type StepKind = "base" | "multiply" | "add" | "cap" | "info" | "override";

export interface CalcStep {
  label: string;
  kind: StepKind;
  /** Factor for multiply steps, e.g. 0.95 */
  factor?: number;
  /** Running value after this step, cents, full precision */
  valueCents: number;
  detail?: string;
}

export type ComponentKind = "envelope" | "basket" | "burner" | "tanks" | "accessories";

export type Provenance = "user_supplied" | "model_reference" | "generic_reference" | "calculated" | "provisional";

export interface ComponentResult {
  kind: ComponentKind;
  label: string;
  /** Full precision value in cents */
  valueCents: number;
  /** Rounded display value in cents */
  displayCents: number;
  provenance: Provenance;
  steps: CalcStep[];
  lines?: { label: string; valueCents: number; displayCents: number; note?: string }[];
  /** For unknown-material tanks: alternative value if the material were steel. */
  conditionalAlternativeCents?: { label: string; minCents: number; maxCents: number };
}

export type FlagSeverity = "critical" | "assumption" | "info";

export interface ValuationFlag {
  code: string;
  severity: FlagSeverity;
  message: string;
}

export interface PolicyApplication {
  code: "age_cap" | "legacy_zero" | "brand_cap" | "brand_zero";
  message: string;
  rawTotalCents: number;
  cappedTotalCents: number;
  policyMaxCents: number;
}

export type AskingClassification = "bargain" | "within" | "overpriced" | "significantly_overpriced" | "not_applicable";

export interface AskingAnalysis {
  askingCents: number;
  fairValueCents: number;
  differenceCents: number;
  /** Null when fair value is zero */
  percent: number | null;
  classification: AskingClassification;
  negotiationLowCents: number;
  negotiationHighCents: number;
  message: string;
}

export interface ValuationResult {
  engineVersion: string;
  configVersion: number;
  valuationDate: string;
  valuationYear: number;
  scope: ValuationScope;
  envelopeAge: number | null;
  hoursConsumedPct: number | null;
  ageDepreciationPct: number | null;
  components: ComponentResult[];
  rawTotalCents: number;
  marketAdjustmentFactor: number;
  adjustedTotalCents: number;
  policies: PolicyApplication[];
  /** Hardware value shown separately when a system policy reduces the system value. */
  separateComponentValueCents: number | null;
  fairMarketValueCents: number;
  rangeLowCents: number;
  rangeHighCents: number;
  listingPriceCents: number;
  listingProvisional: boolean;
  confidence: ConfidenceLevel;
  confidenceRangePct: number;
  flags: ValuationFlag[];
  asking: AskingAnalysis | null;
  legacyMessage: string | null;
  brandMessage: string | null;
}

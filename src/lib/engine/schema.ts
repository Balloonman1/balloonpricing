import { z } from "zod";
import { ACCESSORY_KEYS, ENVELOPE_FEATURE_KEYS } from "./types";
import { includesEnvelope } from "./valuate";

const cents = z.number().int().min(0).max(10_000_000_00);
const condition = z.enum(["A", "B", "C", "D", "E"]);
const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(1000);

export const envelopeSchema = z.object({
  fabric: z.enum(["polyester", "nylon", "hyperlast", "mixed", "unknown"]),
  fabricMix: z
    .array(z.object({ fabric: z.enum(["polyester", "nylon", "hyperlast", "unknown"]), percent: z.number().min(0).max(100) }))
    .max(6)
    .optional(),
  condition: condition.optional(),
  appearance: z.enum(["warm", "neutral", "unattractive"]),
  heavyBranding: z.boolean(),
  features: z.array(z.enum(ENVELOPE_FEATURE_KEYS)).max(ENVELOPE_FEATURE_KEYS.length).optional(),
  otherFeatureNote: shortText.optional(),
  knownReplacementCostCents: cents.optional(),
  inspection: z
    .object({
      lastAnnualDate: z.string().max(20).optional(),
      porosityNote: shortText.optional(),
      fabricStrengthNote: shortText.optional(),
      majorRepairs: longText.optional(),
    })
    .optional(),
});

const year = z.number().int().min(1950).max(2100);

export const basketSchema = z.object({
  manufacturer: shortText.optional(),
  model: shortText.optional(),
  modelId: z.string().max(80).optional(),
  year: year.optional(),
  dimensions: shortText.optional(),
  condition: condition.optional(),
  construction: z.enum(["lightweight", "standard"]).optional(),
  customNote: longText.optional(),
  knownResaleCents: cents.optional(),
});

export const burnerSchema = z.object({
  manufacturer: shortText.optional(),
  model: shortText.optional(),
  modelId: z.string().max(80).optional(),
  configuration: z.enum(["single", "double", "triple"]).optional(),
  glow: z.enum(["glow", "non_glow", "unknown"]),
  year: year.optional(),
  condition: condition.optional(),
  knownResaleCents: cents.optional(),
});

export const tankSchema = z.object({
  manufacturer: shortText.optional(),
  material: z.enum(["aluminum", "steel", "unknown"]),
  capacity: z.enum(["10", "15", "20", "other"]).optional(),
  otherCapacityGallons: z.number().min(1).max(100).optional(),
  quantity: z.number().int().min(1).max(50),
  knownValueEachCents: cents.optional(),
});

export const accessorySchema = z.object({
  key: z.enum(ACCESSORY_KEYS),
  label: shortText.optional(),
  valueCents: cents.optional(),
});

export const valuationInputSchema = z
  .object({
    manufacturer: z.string().trim().min(1, "Choose a manufacturer").max(80),
    model: shortText.optional(),
    volumeCuFt: z.number().min(10000).max(2_000_000).optional(),
    year: year.optional(),
    hours: z.number().min(0).max(20000).optional(),
    category: z.enum(["sport", "commercial", "racer", "special_shape"]),
    scope: z.enum(["envelope_only", "complete_system", "basket_burner", "components"]),
    envelope: envelopeSchema.optional(),
    basket: basketSchema.optional(),
    burner: burnerSchema.optional(),
    tanks: z.array(tankSchema).max(20).optional(),
    accessories: z.array(accessorySchema).max(20).optional(),
    askingPriceCents: cents.optional(),
  })
  .superRefine((v, ctx) => {
    if (includesEnvelope(v.scope)) {
      if (!v.envelope) ctx.addIssue({ code: "custom", path: ["envelope"], message: "Envelope details are required" });
      if (v.year === undefined) ctx.addIssue({ code: "custom", path: ["year"], message: "Enter the envelope year of manufacture" });
      if (v.hours === undefined) ctx.addIssue({ code: "custom", path: ["hours"], message: "Enter total envelope hours" });
      const knownCost = v.envelope?.knownReplacementCostCents;
      const needsVolume = v.category === "sport" || v.category === "commercial";
      if (needsVolume && v.volumeCuFt === undefined && !knownCost) {
        ctx.addIssue({ code: "custom", path: ["volumeCuFt"], message: "Enter the envelope volume in cubic feet" });
      }
    }
  });

export type ValuationInputParsed = z.infer<typeof valuationInputSchema>;

/* ---------------------------------------------------------------- Config */

const volumePoint = z.object({ volumeCuFt: z.number().min(1000).max(2_000_000), priceCents: cents });
const fraction = z.number().min(0).max(1);
const multiplier = z.number().min(0).max(3);

export const configSchema = z.object({
  version: z.number().int().min(1),
  label: z.string().max(200).optional(),
  envelopePrices: z.array(volumePoint).min(1).max(50),
  manufacturerEnvelopePrices: z.array(z.object({ manufacturer: z.string().min(1).max(80), points: z.array(volumePoint).min(1).max(50) })).max(50),
  racerEnvelopeCents: cents,
  specialShapeEnvelopeCents: cents,
  largeBalloonThresholdCuFt: z.number().min(1000),
  referenceHours: z.object({
    sport: z.number().min(1),
    commercial: z.number().min(1),
    racer: z.number().min(1),
    special_shape: z.number().min(1),
  }),
  envelopeAgeCurve: z.array(z.object({ age: z.number().min(0).max(100), depreciation: fraction })).min(1).max(100),
  conditionMultipliers: z.object({ A: multiplier, B: multiplier, C: multiplier, D: multiplier, E: multiplier }),
  fabricMultipliers: z.object({ polyester: multiplier, nylon: multiplier, hyperlast: multiplier, unknown: multiplier }),
  appearanceDeductions: z.object({ warm: fraction, neutral: fraction, unattractive: fraction, heavyBranding: fraction, maxCombined: fraction }),
  basketNewCents: cents,
  burnerNewCents: cents,
  hardwareAgeBands: z.array(z.object({ minAge: z.number().min(0).max(100), remaining: fraction })).min(1).max(30),
  basketModels: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        manufacturer: z.string().min(1).max(80),
        model: z.string().min(1).max(120),
        construction: z.enum(["lightweight", "standard"]).optional(),
        newPriceCents: cents.nullable(),
        note: z.string().max(300).optional(),
      }),
    )
    .max(500),
  burnerModels: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        manufacturer: z.string().min(1).max(80),
        model: z.string().min(1).max(120),
        configuration: z.enum(["single", "double", "triple"]).optional(),
        glow: z.enum(["glow", "non_glow", "any"]),
        usedValueCents: cents.nullable(),
        note: z.string().max(300).optional(),
      }),
    )
    .max(500),
  tankPrices: z.object({ aluminumCents: cents, steel: z.object({ "10": cents, "15": cents, "20": cents }) }),
  accessories: z.array(z.object({ key: z.enum(ACCESSORY_KEYS), label: z.string().min(1).max(80), usedValueCents: cents.nullable() })),
  features: z.array(z.object({ key: z.enum(ENVELOPE_FEATURE_KEYS), label: z.string().min(1).max(80), adjustmentCents: cents.nullable() })),
  brandPolicies: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        manufacturer: z.string().min(1).max(80),
        aliases: z.array(z.string().min(1).max(80)).max(20).optional(),
        kind: z.enum(["cap", "zero"]),
        maxValueCents: cents.optional(),
        typicalMinCents: cents.optional(),
        typicalMaxCents: cents.optional(),
        message: z.string().max(500).optional(),
        active: z.boolean(),
      }),
    )
    .max(100),
  agePolicy: z.object({
    capStartAge: z.number().int().min(0),
    capEndAge: z.number().int().min(0),
    capMaxCents: cents,
    legacyAfterAge: z.number().int().min(0),
  }),
  listingMarkup: z.number().min(0).max(1),
  marketAdjustment: z.number().min(-0.9).max(1),
  manufacturerAdjustments: z.record(z.string(), z.number().min(0.1).max(3)),
  confidenceRanges: z.object({ high: fraction, moderate: fraction, low: fraction }),
  minVerifiedComparablesForHigh: z.number().int().min(1),
  rounding: z.object({ componentCents: cents, totalCents: cents, listingCents: cents }),
  defaultsApplied: z.array(z.string().max(80)).max(200).optional(),
});

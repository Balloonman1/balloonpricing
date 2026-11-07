import type { ValuationConfig, ValuationInput } from "./types";
import { valuate } from "./valuate";

export type VerificationStatus = "asking" | "reported" | "verified";

export interface SaleComparable {
  id: string;
  manufacturer: string;
  model?: string;
  volumeCuFt?: number;
  year?: number;
  hours?: number;
  fabric?: string;
  condition?: string;
  basket?: string;
  burner?: string;
  tanks?: string;
  accessories?: string;
  askingPriceCents?: number;
  salePriceCents?: number;
  dateSold?: string;
  region?: string;
  source?: string;
  verification: VerificationStatus;
  /** Structured equipment description used to compute the model prediction. */
  valuationInput?: ValuationInput;
  notes?: string;
  createdAt?: string;
}

export interface ComparablePrediction {
  comparable: SaleComparable;
  predictedCents: number;
  actualCents: number;
  /** actual - predicted */
  errorCents: number;
  /** null when actual is zero */
  absolutePercentageError: number | null;
}

export interface AccuracyGroup {
  dimension: string;
  bucket: string;
  count: number;
  meanErrorCents: number;
  meanAbsPctError: number | null;
  medianRatio: number | null;
}

export interface AdjustmentSuggestion {
  manufacturer: string;
  sampleSize: number;
  medianRatio: number;
  currentAdjustment: number;
  suggestedAdjustment: number;
}

export function predictionError(actualCents: number, predictedCents: number) {
  const errorCents = actualCents - predictedCents;
  const absolutePercentageError = actualCents > 0 ? (Math.abs(actualCents - predictedCents) / actualCents) * 100 : null;
  return { errorCents, absolutePercentageError };
}

/** Only verified completed sales with a final price and structured equipment input are used. */
export function eligibleForCalibration(c: SaleComparable): boolean {
  return c.verification === "verified" && (c.salePriceCents ?? 0) > 0 && Boolean(c.valuationInput);
}

export function predictComparables(comparables: SaleComparable[], config: ValuationConfig): ComparablePrediction[] {
  return comparables.filter(eligibleForCalibration).map((comparable) => {
    const asOf = comparable.dateSold ? new Date(`${comparable.dateSold}T12:00:00Z`) : new Date();
    const result = valuate({ ...comparable.valuationInput!, askingPriceCents: undefined }, config, { asOf });
    const actualCents = comparable.salePriceCents!;
    const predictedCents = result.fairMarketValueCents;
    return { comparable, predictedCents, actualCents, ...predictionError(actualCents, predictedCents) };
  });
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const ageBucket = (year?: number, sold?: string) => {
  if (!year) return "Unknown";
  const ref = sold ? Number(sold.slice(0, 4)) : new Date().getFullYear();
  const age = ref - year;
  if (age <= 10) return "0-10 years";
  if (age <= 20) return "11-20 years";
  if (age <= 30) return "21-30 years";
  return "31+ years";
};
const volumeBucket = (v?: number) => (!v ? "Unknown" : v < 77000 ? "Under 77K" : v <= 90000 ? "77K-90K" : v <= 120000 ? "91K-120K" : "Over 120K");
const hoursBucket = (h?: number) => (h === undefined ? "Unknown" : h < 200 ? "Under 200 h" : h < 400 ? "200-399 h" : "400+ h");

export function accuracyBreakdown(predictions: ComparablePrediction[]): AccuracyGroup[] {
  const dims: Record<string, (p: ComparablePrediction) => string> = {
    Manufacturer: (p) => p.comparable.manufacturer || "Unknown",
    Age: (p) => ageBucket(p.comparable.valuationInput?.year ?? p.comparable.year, p.comparable.dateSold),
    Volume: (p) => volumeBucket(p.comparable.valuationInput?.volumeCuFt ?? p.comparable.volumeCuFt),
    Type: (p) => p.comparable.valuationInput?.category ?? "Unknown",
    Hours: (p) => hoursBucket(p.comparable.valuationInput?.hours ?? p.comparable.hours),
    Fabric: (p) => p.comparable.valuationInput?.envelope?.fabric ?? p.comparable.fabric ?? "Unknown",
    Configuration: (p) => p.comparable.valuationInput?.scope ?? "Unknown",
  };
  const groups: AccuracyGroup[] = [];
  for (const [dimension, keyOf] of Object.entries(dims)) {
    const buckets = new Map<string, ComparablePrediction[]>();
    for (const p of predictions) {
      const k = keyOf(p);
      buckets.set(k, [...(buckets.get(k) ?? []), p]);
    }
    for (const [bucket, items] of buckets) {
      const apes = items.map((i) => i.absolutePercentageError).filter((x): x is number => x !== null);
      const ratios = items.filter((i) => i.predictedCents > 0).map((i) => i.actualCents / i.predictedCents);
      groups.push({
        dimension,
        bucket,
        count: items.length,
        meanErrorCents: items.reduce((n, i) => n + i.errorCents, 0) / items.length,
        meanAbsPctError: apes.length ? apes.reduce((n, x) => n + x, 0) / apes.length : null,
        medianRatio: median(ratios),
      });
    }
  }
  return groups;
}

/**
 * Suggests manufacturer adjustments. Suggestions are never applied automatically;
 * an administrator must approve them, which creates a new configuration version.
 */
export function suggestAdjustments(
  predictions: ComparablePrediction[],
  config: ValuationConfig,
  minSample = 3,
  threshold = 0.05,
): AdjustmentSuggestion[] {
  const byMfr = new Map<string, number[]>();
  for (const p of predictions) {
    if (p.predictedCents <= 0) continue;
    const m = p.comparable.valuationInput?.manufacturer ?? p.comparable.manufacturer;
    byMfr.set(m, [...(byMfr.get(m) ?? []), p.actualCents / p.predictedCents]);
  }
  const out: AdjustmentSuggestion[] = [];
  for (const [manufacturer, ratios] of byMfr) {
    if (ratios.length < minSample) continue;
    const medianRatio = median(ratios)!;
    if (Math.abs(medianRatio - 1) <= threshold) continue;
    const currentAdjustment = config.manufacturerAdjustments[manufacturer] ?? 1;
    out.push({
      manufacturer,
      sampleSize: ratios.length,
      medianRatio,
      currentAdjustment,
      suggestedAdjustment: Math.round(currentAdjustment * medianRatio * 100) / 100,
    });
  }
  return out.sort((a, b) => b.sampleSize - a.sampleSize);
}

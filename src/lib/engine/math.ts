import type { AgeBand, AgePoint, VolumePricePoint } from "./types";

export function roundTo(valueCents: number, incrementCents: number): number {
  if (!Number.isFinite(valueCents) || valueCents <= 0) return 0;
  if (incrementCents <= 0) return Math.round(valueCents);
  return Math.round(valueCents / incrementCents) * incrementCents;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface InterpolationResult {
  priceCents: number;
  extrapolated: boolean;
  /** "below" or "above" when outside the reference range */
  direction: "within" | "below" | "above";
}

/**
 * Linear interpolation between volume reference points. Outside the range the nearest
 * segment slope is extended and the result is flagged as extrapolated so the caller
 * can disclose it. Never returns less than 0.
 */
export function interpolateVolumePrice(points: VolumePricePoint[], volume: number): InterpolationResult {
  const sorted = [...points].sort((a, b) => a.volumeCuFt - b.volumeCuFt);
  if (sorted.length === 0) throw new Error("No envelope price references configured");
  if (sorted.length === 1) {
    const only = sorted[0];
    return {
      priceCents: only.priceCents,
      extrapolated: volume !== only.volumeCuFt,
      direction: volume === only.volumeCuFt ? "within" : volume < only.volumeCuFt ? "below" : "above",
    };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lerp = (a: VolumePricePoint, b: VolumePricePoint) =>
    a.priceCents + ((volume - a.volumeCuFt) * (b.priceCents - a.priceCents)) / (b.volumeCuFt - a.volumeCuFt);

  if (volume < first.volumeCuFt) {
    return { priceCents: Math.max(0, lerp(sorted[0], sorted[1])), extrapolated: true, direction: "below" };
  }
  if (volume > last.volumeCuFt) {
    return { priceCents: Math.max(0, lerp(sorted[sorted.length - 2], last)), extrapolated: true, direction: "above" };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (volume >= a.volumeCuFt && volume <= b.volumeCuFt) {
      return { priceCents: lerp(a, b), extrapolated: false, direction: "within" };
    }
  }
  return { priceCents: last.priceCents, extrapolated: false, direction: "within" };
}

/** Depreciation fraction for an envelope age, linearly interpolated, clamped at the curve ends. */
export function ageDepreciation(curve: AgePoint[], age: number): number {
  const sorted = [...curve].sort((a, b) => a.age - b.age);
  if (sorted.length === 0) return 0;
  if (age <= sorted[0].age) return clamp(sorted[0].depreciation, 0, 1);
  const last = sorted[sorted.length - 1];
  if (age >= last.age) return clamp(last.depreciation, 0, 1);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (age >= a.age && age <= b.age) {
      const t = (age - a.age) / (b.age - a.age);
      return clamp(a.depreciation + t * (b.depreciation - a.depreciation), 0, 1);
    }
  }
  return clamp(last.depreciation, 0, 1);
}

/** Remaining-value fraction from a stepped age band table. */
export function bandRemaining(bands: AgeBand[], age: number): number {
  const sorted = [...bands].sort((a, b) => a.minAge - b.minAge);
  let remaining = sorted.length ? sorted[0].remaining : 1;
  for (const band of sorted) {
    if (age >= band.minAge) remaining = band.remaining;
  }
  return clamp(remaining, 0, 1);
}

export function formatUsd(cents: number, opts: { cents?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.cents ? 2 : 0,
    minimumFractionDigits: opts.cents ? 2 : 0,
  }).format(cents / 100);
}

export function pct(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

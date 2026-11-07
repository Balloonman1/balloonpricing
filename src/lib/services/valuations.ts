import type { Repository, StoredValuation } from "@/lib/data/types";
import { eligibleForCalibration, type SaleComparable } from "@/lib/engine/calibration";
import { valuationInputSchema } from "@/lib/engine/schema";
import type { ValuationConfig, ValuationInput, ValuationResult } from "@/lib/engine/types";
import { ENGINE_VERSION, includesEnvelope, valuate } from "@/lib/engine/valuate";
import { randomToken, referenceNumber, safeEqual, sha256 } from "@/lib/security";

/**
 * Verified completed sales close enough to support this valuation:
 * same manufacturer, volume within 15%, envelope year within 5 years.
 */
export function supportingComparables(input: ValuationInput, comparables: SaleComparable[]): number {
  if (!includesEnvelope(input.scope)) return 0;
  return comparables.filter((c) => {
    if (!eligibleForCalibration(c)) return false;
    const ci = c.valuationInput!;
    if (ci.manufacturer.toLowerCase() !== input.manufacturer.toLowerCase()) return false;
    if (input.volumeCuFt && ci.volumeCuFt && Math.abs(ci.volumeCuFt - input.volumeCuFt) / input.volumeCuFt > 0.15) return false;
    if (input.year && ci.year && Math.abs(ci.year - input.year) > 5) return false;
    return true;
  }).length;
}

export async function computeValuation(repo: Repository, rawInput: unknown, asOf = new Date()) {
  const parsed = valuationInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  const input = parsed.data as ValuationInput;
  const config = await repo.getActiveConfig();
  const comparables = await repo.listComparables();
  const result = valuate(input, config.snapshot, { asOf, verifiedComparables: supportingComparables(input, comparables) });
  return { ok: true as const, input, result, config };
}

export async function createValuation(repo: Repository, rawInput: unknown, userId: string | null = null) {
  const computed = await computeValuation(repo, rawInput);
  if (!computed.ok) return computed;
  const editToken = randomToken(32);
  const stored = await repo.insertValuation({
    referenceNumber: referenceNumber(),
    userId,
    configVersion: computed.config.version,
    engineVersion: ENGINE_VERSION,
    input: computed.input,
    result: computed.result,
    editTokenHash: sha256(editToken),
  });
  return { ok: true as const, valuation: stored, editToken };
}

/** Owner check: the browser that created it (edit token) or the signed-in owner. */
export function canEdit(v: StoredValuation, editToken: string | null | undefined, userId: string | null | undefined): boolean {
  if (userId && v.userId && v.userId === userId) return true;
  if (editToken && safeEqual(sha256(editToken), v.editTokenHash)) return true;
  return false;
}

export async function recalculateValuation(repo: Repository, v: StoredValuation, rawInput: unknown) {
  const computed = await computeValuation(repo, rawInput);
  if (!computed.ok) return computed;
  const updated = await repo.updateValuation(v.id, {
    input: computed.input,
    result: computed.result,
    configVersion: computed.config.version,
    engineVersion: ENGINE_VERSION,
  });
  return { ok: true as const, valuation: updated! };
}

/**
 * Re-runs a stored valuation with the configuration version and date it used.
 * Used to prove historical reports are reproducible.
 */
export async function reproduceValuation(repo: Repository, v: StoredValuation): Promise<{ result: ValuationResult; config: ValuationConfig } | null> {
  const config = await repo.getConfigByVersion(v.configVersion);
  if (!config) return null;
  const result = valuate(v.input, config.snapshot, {
    asOf: new Date(v.result.valuationDate),
    verifiedComparables: v.result.confidence === "high" ? config.snapshot.minVerifiedComparablesForHigh : 0,
  });
  return { result, config: config.snapshot };
}

/** Public view of a valuation: no tokens, no owner ids, no free-text notes unless the owner shared them. */
export function publicView(v: StoredValuation) {
  const input = structuredClone(v.input);
  if (input.envelope?.inspection) delete input.envelope.inspection;
  if (input.basket?.customNote) delete input.basket.customNote;
  if (input.envelope?.otherFeatureNote) delete input.envelope.otherFeatureNote;
  return {
    id: v.id,
    referenceNumber: v.referenceNumber,
    configVersion: v.configVersion,
    engineVersion: v.engineVersion,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    isShared: v.isShared,
    shareId: v.isShared ? v.shareId : null,
    input,
    result: v.result,
  };
}

export type PublicValuation = ReturnType<typeof publicView>;

export function ownerView(v: StoredValuation) {
  return { ...publicView(v), input: v.input, shareId: v.shareId };
}

import type { SaleComparable } from "@/lib/engine/calibration";
import type { ValuationConfig, ValuationInput, ValuationResult } from "@/lib/engine/types";

export interface ConfigRecord {
  id: string;
  version: number;
  label?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: string | null;
  isActive: boolean;
  snapshot: ValuationConfig;
}

export interface StoredValuation {
  id: string;
  referenceNumber: string;
  userId: string | null;
  configVersion: number;
  engineVersion: string;
  input: ValuationInput;
  result: ValuationResult;
  editTokenHash: string;
  shareId: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewValuation = Omit<StoredValuation, "id" | "createdAt" | "updatedAt" | "shareId" | "isShared">;

export interface ValuationPatch {
  input?: ValuationInput;
  result?: ValuationResult;
  configVersion?: number;
  engineVersion?: string;
  shareId?: string | null;
  isShared?: boolean;
  userId?: string | null;
}

/** Light row used for analytics. */
export interface ValuationStatRow {
  manufacturer: string;
  envelopeAge: number | null;
  hours: number | null;
  fairMarketValueCents: number;
  overpricingPct: number | null;
  createdAt: string;
}

export interface ValuationStats {
  count: number;
  averageValueCents: number | null;
  topManufacturers: { manufacturer: string; count: number }[];
  averageEnvelopeAge: number | null;
  averageEnvelopeHours: number | null;
  averageOverpricingPct: number | null;
  askingSampleSize: number;
  last30Days: number;
}

export interface Repository {
  mode: "supabase" | "netlify-blobs" | "demo";
  getActiveConfig(): Promise<ConfigRecord>;
  getConfigByVersion(version: number): Promise<ConfigRecord | null>;
  listConfigs(): Promise<ConfigRecord[]>;
  createConfigVersion(snapshot: Omit<ValuationConfig, "version">, meta: { label?: string; notes?: string; createdBy?: string; activate?: boolean }): Promise<ConfigRecord>;
  activateConfig(version: number): Promise<void>;

  insertValuation(v: NewValuation): Promise<StoredValuation>;
  getValuation(id: string): Promise<StoredValuation | null>;
  getValuationByShareId(shareId: string): Promise<StoredValuation | null>;
  updateValuation(id: string, patch: ValuationPatch): Promise<StoredValuation | null>;
  deleteValuation(id: string): Promise<void>;
  listValuationsForUser(userId: string): Promise<StoredValuation[]>;
  listValuationStatRows(limit?: number): Promise<ValuationStatRow[]>;

  listComparables(): Promise<SaleComparable[]>;
  upsertComparable(c: SaleComparable): Promise<SaleComparable>;
  deleteComparable(id: string): Promise<void>;
}

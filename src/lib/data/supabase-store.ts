import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaleComparable, VerificationStatus } from "@/lib/engine/calibration";
import { DEFAULT_CONFIG } from "@/lib/engine/defaults";
import type { ValuationConfig, ValuationInput, ValuationResult } from "@/lib/engine/types";
import { includesEnvelope } from "@/lib/engine/valuate";
import type { ConfigRecord, NewValuation, Repository, StoredValuation, ValuationPatch, ValuationStatRow } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const toConfig = (r: any): ConfigRecord => ({
  id: r.id,
  version: r.version,
  label: r.label,
  notes: r.notes,
  createdBy: r.created_by,
  createdAt: r.created_at,
  isActive: r.is_active,
  snapshot: { ...r.snapshot, version: r.version } as ValuationConfig,
});

const toValuation = (r: any): StoredValuation => ({
  id: r.id,
  referenceNumber: r.reference_number,
  userId: r.user_id,
  configVersion: r.config_version,
  engineVersion: r.engine_version,
  input: r.input as ValuationInput,
  result: r.result as ValuationResult,
  editTokenHash: r.edit_token_hash,
  shareId: r.share_id,
  isShared: r.is_shared,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const num = (v: any) => (v === null || v === undefined ? undefined : Number(v));

const toComparable = (r: any): SaleComparable => ({
  id: r.id,
  manufacturer: r.manufacturer,
  model: r.model ?? undefined,
  volumeCuFt: num(r.volume_cuft),
  year: num(r.manufacture_year),
  hours: num(r.envelope_hours),
  fabric: r.fabric ?? undefined,
  condition: r.condition ?? undefined,
  basket: r.basket ?? undefined,
  burner: r.burner ?? undefined,
  tanks: r.tanks ?? undefined,
  accessories: r.accessories ?? undefined,
  askingPriceCents: num(r.asking_price_cents),
  salePriceCents: num(r.sale_price_cents),
  dateSold: r.date_sold ?? undefined,
  region: r.region ?? undefined,
  source: r.data_source ?? undefined,
  verification: r.verification_status as VerificationStatus,
  valuationInput: r.valuation_input ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at,
});

function valuationColumns(input: ValuationInput, result: ValuationResult) {
  return {
    manufacturer: input.manufacturer,
    model: input.model ?? null,
    scope: input.scope,
    envelope_year: includesEnvelope(input.scope) ? (input.year ?? null) : null,
    envelope_age: result.envelopeAge,
    envelope_hours: includesEnvelope(input.scope) ? (input.hours ?? null) : null,
    fair_market_value_cents: result.fairMarketValueCents,
    listing_price_cents: result.listingPriceCents,
    asking_price_cents: input.askingPriceCents ?? null,
    overpricing_pct: result.asking?.percent ?? null,
    confidence: result.confidence,
  };
}

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message ?? String(res.error));
  return res.data;
}

export function createSupabaseRepository(db: SupabaseClient): Repository {
  async function configId(version: number): Promise<string | null> {
    const r = check(await db.from("valuation_configs").select("id").eq("version", version).maybeSingle());
    return (r as any)?.id ?? null;
  }

  async function writeComponents(valuationId: string, result: ValuationResult) {
    check(await db.from("valuation_components").delete().eq("valuation_id", valuationId));
    if (result.components.length === 0) return;
    check(
      await db.from("valuation_components").insert(
        result.components.map((c) => ({
          valuation_id: valuationId,
          kind: c.kind,
          label: c.label,
          value_cents: Math.round(c.valueCents),
          provenance: c.provenance,
        })),
      ),
    );
  }

  const repo: Repository = {
    mode: "supabase",

    async getActiveConfig() {
      const row = check(await db.from("valuation_configs").select("*").eq("is_active", true).maybeSingle());
      if (row) return toConfig(row);
      // First run without the seed: install the default configuration.
      const inserted = check(
        await db
          .from("valuation_configs")
          .insert({ version: 1, label: DEFAULT_CONFIG.label, notes: "Initial expert pricing assumptions", snapshot: DEFAULT_CONFIG, is_active: true, created_by: "auto-seed" })
          .select("*")
          .single(),
      );
      return toConfig(inserted);
    },
    async getConfigByVersion(version) {
      const row = check(await db.from("valuation_configs").select("*").eq("version", version).maybeSingle());
      return row ? toConfig(row) : null;
    },
    async listConfigs() {
      const rows = check(await db.from("valuation_configs").select("*").order("version", { ascending: false }).limit(200));
      return (rows as any[]).map(toConfig);
    },
    async createConfigVersion(snapshot, meta) {
      const latest = check(await db.from("valuation_configs").select("version").order("version", { ascending: false }).limit(1).maybeSingle());
      const version = ((latest as any)?.version ?? 0) + 1;
      const row = check(
        await db
          .from("valuation_configs")
          .insert({ version, label: meta.label ?? null, notes: meta.notes ?? null, created_by: meta.createdBy ?? null, snapshot: { ...snapshot, version }, is_active: false })
          .select("*")
          .single(),
      );
      if (meta.activate !== false) {
        check(await db.rpc("activate_valuation_config", { p_version: version }));
        return { ...toConfig(row), isActive: true };
      }
      return toConfig(row);
    },
    async activateConfig(version) {
      check(await db.rpc("activate_valuation_config", { p_version: version }));
    },

    async insertValuation(v: NewValuation) {
      const row = check(
        await db
          .from("valuations")
          .insert({
            reference_number: v.referenceNumber,
            user_id: v.userId,
            config_id: await configId(v.configVersion),
            config_version: v.configVersion,
            engine_version: v.engineVersion,
            input: v.input,
            result: v.result,
            edit_token_hash: v.editTokenHash,
            ...valuationColumns(v.input, v.result),
          })
          .select("*")
          .single(),
      );
      await writeComponents((row as any).id, v.result);
      return toValuation(row);
    },
    async getValuation(id) {
      const row = check(await db.from("valuations").select("*").eq("id", id).maybeSingle());
      return row ? toValuation(row) : null;
    },
    async getValuationByShareId(shareId) {
      const row = check(await db.from("valuations").select("*").eq("share_id", shareId).eq("is_shared", true).maybeSingle());
      return row ? toValuation(row) : null;
    },
    async updateValuation(id, patch: ValuationPatch) {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (patch.input && patch.result) {
        update.input = patch.input;
        update.result = patch.result;
        Object.assign(update, valuationColumns(patch.input, patch.result));
      }
      if (patch.configVersion !== undefined) {
        update.config_version = patch.configVersion;
        update.config_id = await configId(patch.configVersion);
      }
      if (patch.engineVersion !== undefined) update.engine_version = patch.engineVersion;
      if (patch.shareId !== undefined) update.share_id = patch.shareId;
      if (patch.isShared !== undefined) update.is_shared = patch.isShared;
      if (patch.userId !== undefined) update.user_id = patch.userId;
      const row = check(await db.from("valuations").update(update).eq("id", id).select("*").maybeSingle());
      if (row && patch.result) await writeComponents(id, patch.result);
      return row ? toValuation(row) : null;
    },
    async deleteValuation(id) {
      check(await db.from("valuations").delete().eq("id", id));
    },
    async listValuationsForUser(userId) {
      const rows = check(await db.from("valuations").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200));
      return (rows as any[]).map(toValuation);
    },
    async listValuationStatRows(limit = 5000) {
      const rows = check(
        await db
          .from("valuations")
          .select("manufacturer, envelope_age, envelope_hours, fair_market_value_cents, overpricing_pct, created_at")
          .order("created_at", { ascending: false })
          .limit(limit),
      );
      return (rows as any[]).map(
        (r): ValuationStatRow => ({
          manufacturer: r.manufacturer ?? "Unknown",
          envelopeAge: r.envelope_age,
          hours: r.envelope_hours === null ? null : Number(r.envelope_hours),
          fairMarketValueCents: Number(r.fair_market_value_cents),
          overpricingPct: r.overpricing_pct === null ? null : Number(r.overpricing_pct),
          createdAt: r.created_at,
        }),
      );
    },

    async listComparables() {
      const rows = check(await db.from("sale_comparables").select("*").order("date_sold", { ascending: false, nullsFirst: false }).limit(2000));
      return (rows as any[]).map(toComparable);
    },
    async upsertComparable(c) {
      const payload = {
        ...(c.id ? { id: c.id } : {}),
        manufacturer: c.manufacturer,
        model: c.model ?? null,
        volume_cuft: c.volumeCuFt ?? null,
        manufacture_year: c.year ?? null,
        envelope_hours: c.hours ?? null,
        fabric: c.fabric ?? null,
        condition: c.condition ?? null,
        basket: c.basket ?? null,
        burner: c.burner ?? null,
        tanks: c.tanks ?? null,
        accessories: c.accessories ?? null,
        asking_price_cents: c.askingPriceCents ?? null,
        sale_price_cents: c.verification === "asking" ? null : (c.salePriceCents ?? null),
        date_sold: c.dateSold ?? null,
        region: c.region ?? null,
        data_source: c.source ?? null,
        verification_status: c.verification,
        valuation_input: c.valuationInput ?? null,
        notes: c.notes ?? null,
      };
      const row = check(await db.from("sale_comparables").upsert(payload).select("*").single());
      return toComparable(row);
    },
    async deleteComparable(id) {
      check(await db.from("sale_comparables").delete().eq("id", id));
    },
  };
  return repo;
}

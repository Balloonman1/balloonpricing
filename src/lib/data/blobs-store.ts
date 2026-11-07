import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import type { SaleComparable } from "@/lib/engine/calibration";
import { DEFAULT_CONFIG } from "@/lib/engine/defaults";
import type { ValuationConfig } from "@/lib/engine/types";
import { toStatRow } from "./stats";
import type { ConfigRecord, NewValuation, Repository, StoredValuation, ValuationPatch } from "./types";

/**
 * Durable storage on Netlify without a database, using Netlify Blobs.
 * Used automatically on Netlify when Supabase is not configured.
 * One key per record so concurrent serverless instances never overwrite each other's data.
 *
 * Keys:
 *   config/000001          ConfigRecord (immutable once written)
 *   meta/active            { version }
 *   valuation/<id>         StoredValuation
 *   share/<shareId>        { id }
 *   comparable/<id>        SaleComparable
 */
const store = () => getStore({ name: "balloon-bluebook", consistency: "strong" });
const configKey = (v: number) => `config/${String(v).padStart(6, "0")}`;

async function listKeys(prefix: string): Promise<string[]> {
  const { blobs } = await store().list({ prefix });
  return blobs.map((b) => b.key);
}

async function getJson<T>(key: string): Promise<T | null> {
  return ((await store().get(key, { type: "json" })) as T | null) ?? null;
}

async function ensureSeed(): Promise<void> {
  if ((await listKeys("config/")).length > 0) return;
  const record: ConfigRecord = {
    id: randomUUID(),
    version: 1,
    label: DEFAULT_CONFIG.label,
    notes: "Initial expert pricing assumptions",
    createdAt: new Date().toISOString(),
    createdBy: "seed",
    isActive: true,
    snapshot: structuredClone(DEFAULT_CONFIG),
  };
  await store().setJSON(configKey(1), record);
  await store().setJSON("meta/active", { version: 1 });
}

async function activeVersion(): Promise<number> {
  await ensureSeed();
  const meta = await getJson<{ version: number }>("meta/active");
  if (meta?.version) return meta.version;
  const keys = await listKeys("config/");
  return Math.max(...keys.map((k) => Number(k.split("/")[1])));
}

async function allConfigs(): Promise<ConfigRecord[]> {
  await ensureSeed();
  const active = await activeVersion();
  const keys = await listKeys("config/");
  const rows = await Promise.all(keys.map((k) => getJson<ConfigRecord>(k)));
  return rows.filter((r): r is ConfigRecord => Boolean(r)).map((r) => ({ ...r, isActive: r.version === active }));
}

async function allOf<T>(prefix: string): Promise<T[]> {
  const keys = await listKeys(prefix);
  const rows = await Promise.all(keys.map((k) => getJson<T>(k)));
  return rows.filter((r): r is NonNullable<typeof r> => r !== null) as T[];
}

export const blobsRepository: Repository = {
  mode: "netlify-blobs",

  async getActiveConfig() {
    const v = await activeVersion();
    const r = await getJson<ConfigRecord>(configKey(v));
    if (!r) throw new Error("Active pricing configuration is missing");
    return { ...r, isActive: true };
  },
  async getConfigByVersion(version) {
    const r = await getJson<ConfigRecord>(configKey(version));
    if (!r) return null;
    return { ...r, isActive: version === (await activeVersion()) };
  },
  async listConfigs() {
    return (await allConfigs()).sort((a, b) => b.version - a.version);
  },
  async createConfigVersion(snapshot, meta) {
    await ensureSeed();
    const keys = await listKeys("config/");
    const version = Math.max(0, ...keys.map((k) => Number(k.split("/")[1]))) + 1;
    const record: ConfigRecord = {
      id: randomUUID(),
      version,
      label: meta.label ?? null,
      notes: meta.notes ?? null,
      createdBy: meta.createdBy ?? null,
      createdAt: new Date().toISOString(),
      isActive: meta.activate !== false,
      snapshot: { ...(structuredClone(snapshot) as Omit<ValuationConfig, "version">), version } as ValuationConfig,
    };
    // onlyIfNew guards against two saves claiming the same version number.
    const res = await store().setJSON(configKey(version), record, { onlyIfNew: true });
    if (res && "modified" in res && res.modified === false) throw new Error("Another change was saved at the same time. Reload and try again.");
    if (meta.activate !== false) await store().setJSON("meta/active", { version });
    return record;
  },
  async activateConfig(version) {
    if (!(await getJson(configKey(version)))) throw new Error(`Config version ${version} not found`);
    await store().setJSON("meta/active", { version });
  },

  async insertValuation(v: NewValuation) {
    const now = new Date().toISOString();
    const row: StoredValuation = { ...v, id: randomUUID(), shareId: null, isShared: false, createdAt: now, updatedAt: now };
    await store().setJSON(`valuation/${row.id}`, row);
    return row;
  },
  async getValuation(id) {
    return getJson<StoredValuation>(`valuation/${id}`);
  },
  async getValuationByShareId(shareId) {
    const ptr = await getJson<{ id: string }>(`share/${shareId}`);
    if (!ptr) return null;
    const v = await getJson<StoredValuation>(`valuation/${ptr.id}`);
    return v && v.isShared && v.shareId === shareId ? v : null;
  },
  async updateValuation(id, patch: ValuationPatch) {
    const v = await getJson<StoredValuation>(`valuation/${id}`);
    if (!v) return null;
    if (patch.shareId !== undefined && v.shareId && v.shareId !== patch.shareId) await store().delete(`share/${v.shareId}`);
    const next: StoredValuation = { ...v, ...patch, updatedAt: new Date().toISOString() } as StoredValuation;
    await store().setJSON(`valuation/${id}`, next);
    if (next.shareId && next.isShared) await store().setJSON(`share/${next.shareId}`, { id });
    return next;
  },
  async deleteValuation(id) {
    const v = await getJson<StoredValuation>(`valuation/${id}`);
    if (v?.shareId) await store().delete(`share/${v.shareId}`);
    await store().delete(`valuation/${id}`);
  },
  async listValuationsForUser(userId) {
    return (await allOf<StoredValuation>("valuation/")).filter((v) => v.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listValuationStatRows(limit = 5000) {
    const rows = await allOf<StoredValuation>("valuation/");
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toStatRow);
  },

  async listComparables() {
    return (await allOf<SaleComparable>("comparable/")).sort((a, b) => (b.dateSold ?? "").localeCompare(a.dateSold ?? ""));
  },
  async upsertComparable(c) {
    const row = { ...c, id: c.id || randomUUID(), createdAt: c.createdAt ?? new Date().toISOString() };
    await store().setJSON(`comparable/${row.id}`, row);
    return row;
  },
  async deleteComparable(id) {
    await store().delete(`comparable/${id}`);
  },
};

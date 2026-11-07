import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SaleComparable } from "@/lib/engine/calibration";
import { DEFAULT_CONFIG } from "@/lib/engine/defaults";
import type { ValuationConfig } from "@/lib/engine/types";
import { toStatRow } from "./stats";
import type { ConfigRecord, NewValuation, Repository, StoredValuation, ValuationPatch } from "./types";

/**
 * Local demo mode used when Supabase credentials are not configured.
 * Data lives in memory and is mirrored to a JSON file so it survives restarts in
 * local development. On serverless hosts the file sits in temporary storage and
 * may be reset at any time, so production deployments should use Supabase.
 */
interface DemoData {
  configs: ConfigRecord[];
  valuations: StoredValuation[];
  comparables: SaleComparable[];
}

const g = globalThis as unknown as { __bluebookDemo?: DemoData };

function dataFile(): string {
  const dir = process.env.DEMO_DATA_DIR || (process.env.VERCEL ? "/tmp/balloon-bluebook" : path.join(process.cwd(), ".data"));
  return path.join(dir, "demo-db.json");
}

function seed(): DemoData {
  return {
    configs: [
      {
        id: randomUUID(),
        version: 1,
        label: DEFAULT_CONFIG.label,
        notes: "Initial expert pricing assumptions",
        createdAt: new Date().toISOString(),
        createdBy: "seed",
        isActive: true,
        snapshot: structuredClone(DEFAULT_CONFIG),
      },
    ],
    valuations: [],
    comparables: [],
  };
}

function load(): DemoData {
  if (g.__bluebookDemo) return g.__bluebookDemo;
  let data: DemoData | null = null;
  try {
    const file = dataFile();
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf8")) as DemoData;
  } catch {
    data = null;
  }
  if (!data || !Array.isArray(data.configs) || data.configs.length === 0) data = seed();
  g.__bluebookDemo = data;
  return data;
}

function persist() {
  const data = g.__bluebookDemo;
  if (!data) return;
  try {
    const file = dataFile();
    mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  } catch {
    // Read-only filesystem: keep the in-memory copy.
  }
}

const clone = <T,>(x: T): T => structuredClone(x);

export function resetDemoStore() {
  g.__bluebookDemo = seed();
}

export const demoRepository: Repository = {
  mode: "demo",

  async getActiveConfig() {
    const d = load();
    return clone(d.configs.find((c) => c.isActive) ?? d.configs[d.configs.length - 1]);
  },
  async getConfigByVersion(version) {
    const c = load().configs.find((x) => x.version === version);
    return c ? clone(c) : null;
  },
  async listConfigs() {
    return clone([...load().configs].sort((a, b) => b.version - a.version));
  },
  async createConfigVersion(snapshot, meta) {
    const d = load();
    const version = Math.max(...d.configs.map((c) => c.version)) + 1;
    const record: ConfigRecord = {
      id: randomUUID(),
      version,
      label: meta.label ?? null,
      notes: meta.notes ?? null,
      createdBy: meta.createdBy ?? null,
      createdAt: new Date().toISOString(),
      isActive: false,
      snapshot: { ...(clone(snapshot) as Omit<ValuationConfig, "version">), version } as ValuationConfig,
    };
    d.configs.push(record);
    if (meta.activate !== false) {
      for (const c of d.configs) c.isActive = c.version === version;
      record.isActive = true;
    }
    persist();
    return clone(record);
  },
  async activateConfig(version) {
    const d = load();
    if (!d.configs.some((c) => c.version === version)) throw new Error(`Config version ${version} not found`);
    for (const c of d.configs) c.isActive = c.version === version;
    persist();
  },

  async insertValuation(v: NewValuation) {
    const d = load();
    const now = new Date().toISOString();
    const row: StoredValuation = { ...clone(v), id: randomUUID(), shareId: null, isShared: false, createdAt: now, updatedAt: now };
    d.valuations.push(row);
    if (d.valuations.length > 5000) d.valuations.splice(0, d.valuations.length - 5000);
    persist();
    return clone(row);
  },
  async getValuation(id) {
    const v = load().valuations.find((x) => x.id === id);
    return v ? clone(v) : null;
  },
  async getValuationByShareId(shareId) {
    const v = load().valuations.find((x) => x.shareId === shareId && x.isShared);
    return v ? clone(v) : null;
  },
  async updateValuation(id, patch: ValuationPatch) {
    const d = load();
    const v = d.valuations.find((x) => x.id === id);
    if (!v) return null;
    Object.assign(v, clone(patch), { updatedAt: new Date().toISOString() });
    persist();
    return clone(v);
  },
  async deleteValuation(id) {
    const d = load();
    d.valuations = d.valuations.filter((x) => x.id !== id);
    persist();
  },
  async listValuationsForUser(userId) {
    return clone(load().valuations.filter((v) => v.userId === userId).reverse());
  },
  async listValuationStatRows(limit = 5000) {
    return load().valuations.slice(-limit).map(toStatRow);
  },

  async listComparables() {
    return clone([...load().comparables].sort((a, b) => (b.dateSold ?? "").localeCompare(a.dateSold ?? "")));
  },
  async upsertComparable(c) {
    const d = load();
    const row = { ...clone(c), id: c.id || randomUUID(), createdAt: c.createdAt ?? new Date().toISOString() };
    const i = d.comparables.findIndex((x) => x.id === row.id);
    if (i >= 0) d.comparables[i] = row;
    else d.comparables.push(row);
    persist();
    return clone(row);
  },
  async deleteComparable(id) {
    const d = load();
    d.comparables = d.comparables.filter((x) => x.id !== id);
    persist();
  },
};

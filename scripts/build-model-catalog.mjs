#!/usr/bin/env node
/**
 * Builds src/data/model-catalog.json from the Balloon History Archive registry export
 * (balloon-archive/data/registry.json, sourced from The HAB Database).
 *
 * Usage:
 *   node scripts/build-model-catalog.mjs ../balloon-archive/data/registry.json
 *
 * The catalog only feeds the model dropdown and volume/category suggestions.
 * It carries no prices. Users can always type a model that is not listed.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-model-catalog.mjs <path to registry.json>");
  process.exit(1);
}
const out = resolve(process.argv[3] ?? "src/data/model-catalog.json");
const data = JSON.parse(readFileSync(input, "utf8"));
const records = Array.isArray(data.registry) ? data.registry : Object.values(data.merged ?? {});

/** Registry family -> Balloon Bluebook manufacturer names that share that model list. */
const FAMILY_TO_MANUFACTURERS = {
  Cameron: ["Cameron"],
  Raven: ["Aerostar", "Raven"],
  Lindstrand: ["Lindstrand"],
  Ultramagic: ["Ultramagic"],
  Kubicek: ["Kubicek"],
  "The Balloon Works": ["Firefly", "Balloon Works"],
  "Thunder & Colt": ["Thunder & Colt"],
  Adams: ["Adams"],
  "Schroeder Fire": ["Schroeder"],
};
const PRIMARY = ["Cameron", "Aerostar", "Lindstrand", "Ultramagic", "Kubicek", "Firefly", "Raven", "Thunder & Colt", "Balloon Works", "Adams", "Schroeder"];
const SKIP_FAMILIES = new Set(["", "N/A"]);

const isJunkModel = (m) =>
  !m || /^n\/?a$/i.test(m) || /^\d{4}-\d{2}-\d{2}$/.test(m) || /^unknown$/i.test(m);

const parseVolume = (size) => {
  if (!size) return null;
  const match = String(size).replace(/,/g, "").match(/(\d{4,7})\s*(cu|cubic)/i);
  return match ? Number(match[1]) : null;
};

const categoryOf = (type, volume) => {
  const t = (type || "").toLowerCase();
  if (t.includes("special shape")) return "special_shape";
  if (t.includes("racer")) return "racer";
  if (volume && volume >= 150000) return "commercial";
  return "sport";
};

const mode = (arr) => {
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const groups = new Map(); // family -> key -> {spellings, volumes, cats, years}
let skippedDates = 0;
for (const r of records) {
  const family = (r.family || "").trim();
  if (SKIP_FAMILIES.has(family)) continue;
  const model = (r.model || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(model)) skippedDates++;
  if (isJunkModel(model)) continue;
  const key = model.toUpperCase().replace(/[\s.]/g, "");
  if (!groups.has(family)) groups.set(family, new Map());
  const fam = groups.get(family);
  if (!fam.has(key)) fam.set(key, { spellings: [], volumes: [], cats: [], years: [] });
  const g = fam.get(key);
  const volume = parseVolume(r.size);
  g.spellings.push(model);
  if (volume) g.volumes.push(volume);
  g.cats.push(categoryOf(r.type, volume));
  const year = Number(String(r.year || "").slice(0, 4));
  if (year >= 1950 && year <= 2100) g.years.push(year);
}

const familyModels = (family) => {
  const fam = groups.get(family);
  if (!fam) return [];
  return [...fam.values()]
    .map((g) => {
      const vols = mode(g.volumes);
      return {
        model: mode(g.spellings)[0][0],
        count: g.spellings.length,
        volumeCuFt: vols.length ? vols[0][0] : null,
        otherVolumes: vols.slice(1, 3).map(([v]) => v),
        category: mode(g.cats)[0][0],
        yearMin: g.years.length ? Math.min(...g.years) : null,
        yearMax: g.years.length ? Math.max(...g.years) : null,
      };
    })
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model, "en", { numeric: true }));
};

const manufacturers = [];
for (const name of PRIMARY) {
  const families = Object.entries(FAMILY_TO_MANUFACTURERS)
    .filter(([, names]) => names.includes(name))
    .map(([f]) => f);
  manufacturers.push({ name, primary: true, registryFamilies: families, models: families.flatMap(familyModels) });
}
const mapped = new Set(Object.keys(FAMILY_TO_MANUFACTURERS));
const extra = [...groups.keys()].filter((f) => !mapped.has(f)).sort((a, b) => a.localeCompare(b));
for (const family of extra) {
  manufacturers.push({ name: family, primary: false, registryFamilies: [family], models: familyModels(family) });
}

const catalog = {
  source: {
    name: data.source?.name ?? "The HAB Database",
    url: data.source?.url ?? "https://thehabdatabase.com/",
    via: "Balloon History Archive",
    exported: data.source?.exported ?? null,
  },
  generated: new Date().toISOString().slice(0, 10),
  recordCount: records.length,
  manufacturers,
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(catalog));
const modelCount = manufacturers.reduce((n, m) => n + m.models.length, 0);
console.log(`Wrote ${out}: ${manufacturers.length} manufacturers, ${modelCount} model entries from ${records.length} records.`);
if (skippedDates) console.log(`Skipped ${skippedDates} records whose model looks like a spreadsheet date (e.g. 2026-07-15).`);

import type { SaleComparable, VerificationStatus } from "@/lib/engine/calibration";
import type { BalloonCategory, Condition, Fabric, TankCapacity, TankMaterial, ValuationInput, ValuationScope } from "@/lib/engine/types";

/** Column order for import templates and exports. */
export const CSV_COLUMNS = [
  "manufacturer",
  "model",
  "volume_cuft",
  "year",
  "hours",
  "category",
  "scope",
  "fabric",
  "condition",
  "appearance",
  "heavy_branding",
  "basket",
  "basket_year",
  "basket_condition",
  "basket_known_value",
  "burner",
  "burner_manufacturer",
  "burner_model",
  "burner_glow",
  "burner_year",
  "burner_known_value",
  "tanks",
  "tank_material",
  "tank_capacity",
  "tank_quantity",
  "accessories",
  "trailer",
  "inflation_fan",
  "asking_price",
  "sale_price",
  "date_sold",
  "region",
  "source",
  "verification",
  "notes",
] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const esc = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const money = (s?: string) => {
  if (!s || !s.trim()) return undefined;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};
const numOf = (s?: string) => {
  if (!s || !s.trim()) return undefined;
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};
const yes = (s?: string) => /^(y|yes|true|1)$/i.test((s ?? "").trim());
const pick = <T extends string>(s: string | undefined, allowed: readonly T[]): T | undefined => {
  const v = (s ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_") as T;
  return allowed.includes(v) ? v : undefined;
};

export interface CsvImportResult {
  comparables: SaleComparable[];
  errors: { line: number; message: string }[];
}

export function comparablesFromCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  const errors: CsvImportResult["errors"] = [];
  if (rows.length === 0) return { comparables: [], errors: [{ line: 1, message: "The file is empty." }] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (!header.includes("manufacturer") || !header.includes("verification")) {
    return { comparables: [], errors: [{ line: 1, message: "The header row needs at least manufacturer and verification columns." }] };
  }
  const comparables: SaleComparable[] = [];
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (k: string) => {
      const i = header.indexOf(k);
      return i >= 0 ? cells[i]?.trim() : undefined;
    };
    const manufacturer = get("manufacturer");
    const verification = pick<VerificationStatus>(get("verification"), ["asking", "reported", "verified"]);
    if (!manufacturer) return errors.push({ line, message: "Missing manufacturer." });
    if (!verification) return errors.push({ line, message: "Verification must be asking, reported or verified." });
    const salePriceCents = money(get("sale_price"));
    const askingPriceCents = money(get("asking_price"));
    const dateSold = get("date_sold") || undefined;
    if (verification === "asking" && salePriceCents !== undefined) return errors.push({ line, message: "An asking-price record cannot have a sale price." });
    if (verification === "verified" && (salePriceCents === undefined || !dateSold)) return errors.push({ line, message: "Verified sales need a sale price and date sold." });
    if (dateSold && !/^\d{4}-\d{2}-\d{2}$/.test(dateSold)) return errors.push({ line, message: "Use YYYY-MM-DD for date_sold." });

    const scope = pick<ValuationScope>(get("scope"), ["envelope_only", "complete_system", "basket_burner", "components"]) ?? "complete_system";
    const category = pick<BalloonCategory>(get("category"), ["sport", "commercial", "racer", "special_shape"]) ?? "sport";
    const year = numOf(get("year"));
    const hours = numOf(get("hours"));
    const volumeCuFt = numOf(get("volume_cuft"));
    const fabric = pick<Fabric>(get("fabric"), ["polyester", "nylon", "hyperlast", "mixed", "unknown"]) ?? "unknown";
    const condRaw = (get("condition") ?? "").trim().toUpperCase().charAt(0);
    const condition = (["A", "B", "C", "D", "E"].includes(condRaw) ? condRaw : undefined) as Condition | undefined;

    let valuationInput: ValuationInput | undefined;
    const hasEnvelope = scope === "envelope_only" || scope === "complete_system";
    if (!hasEnvelope || (year && hours !== undefined)) {
      valuationInput = {
        manufacturer,
        model: get("model") || undefined,
        volumeCuFt,
        year,
        hours,
        category,
        scope,
        envelope: hasEnvelope
          ? {
              fabric,
              condition,
              appearance: pick(get("appearance"), ["warm", "neutral", "unattractive"] as const) ?? "warm",
              heavyBranding: yes(get("heavy_branding")),
            }
          : undefined,
      };
      if (scope !== "envelope_only") {
        const bYear = numOf(get("basket_year"));
        const bKnown = money(get("basket_known_value"));
        if (bYear || bKnown !== undefined || get("basket")) {
          const bc = (get("basket_condition") ?? "").toUpperCase() as Condition;
          valuationInput.basket = { year: bYear, knownResaleCents: bKnown, condition: ["A", "B", "C", "D", "E"].includes(bc) ? bc : undefined, model: get("basket") || undefined };
        }
        const brModel = get("burner_model");
        const brKnown = money(get("burner_known_value"));
        if (brModel || brKnown !== undefined || get("burner")) {
          valuationInput.burner = {
            manufacturer: get("burner_manufacturer") || undefined,
            model: brModel || undefined,
            glow: pick(get("burner_glow"), ["glow", "non_glow", "unknown"] as const) ?? "unknown",
            year: numOf(get("burner_year")),
            knownResaleCents: brKnown,
          };
        }
        const material = pick<TankMaterial>(get("tank_material"), ["aluminum", "steel", "unknown"]);
        const qty = numOf(get("tank_quantity"));
        if (material && qty) {
          const cap = (get("tank_capacity") ?? "").replace(/\D/g, "");
          valuationInput.tanks = [{ material, quantity: qty, capacity: (["10", "15", "20"].includes(cap) ? cap : cap ? "other" : undefined) as TankCapacity | undefined }];
        }
        const acc = [];
        if (yes(get("trailer"))) acc.push({ key: "trailer" as const });
        if (yes(get("inflation_fan"))) acc.push({ key: "inflation_fan" as const });
        if (acc.length) valuationInput.accessories = acc;
      }
    }

    comparables.push({
      id: "",
      manufacturer,
      model: get("model") || undefined,
      volumeCuFt,
      year,
      hours,
      fabric: get("fabric") || undefined,
      condition: get("condition") || undefined,
      basket: get("basket") || undefined,
      burner: get("burner") || [get("burner_manufacturer"), get("burner_model")].filter(Boolean).join(" ") || undefined,
      tanks: get("tanks") || undefined,
      accessories: get("accessories") || undefined,
      askingPriceCents,
      salePriceCents: verification === "asking" ? undefined : salePriceCents,
      dateSold,
      region: get("region") || undefined,
      source: get("source") || undefined,
      verification,
      valuationInput,
      notes: get("notes") || undefined,
    });
  });
  return { comparables, errors };
}

export function comparablesToCsv(list: SaleComparable[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const c of list) {
    const vi = c.valuationInput;
    const t = vi?.tanks?.[0];
    const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      manufacturer: c.manufacturer,
      model: c.model,
      volume_cuft: c.volumeCuFt ?? vi?.volumeCuFt,
      year: c.year ?? vi?.year,
      hours: c.hours ?? vi?.hours,
      category: vi?.category,
      scope: vi?.scope,
      fabric: c.fabric ?? vi?.envelope?.fabric,
      condition: c.condition ?? vi?.envelope?.condition,
      appearance: vi?.envelope?.appearance,
      heavy_branding: vi?.envelope ? (vi.envelope.heavyBranding ? "yes" : "no") : "",
      basket: c.basket,
      basket_year: vi?.basket?.year,
      basket_condition: vi?.basket?.condition,
      basket_known_value: vi?.basket?.knownResaleCents !== undefined ? vi.basket.knownResaleCents / 100 : "",
      burner: c.burner,
      burner_manufacturer: vi?.burner?.manufacturer,
      burner_model: vi?.burner?.model,
      burner_glow: vi?.burner?.glow,
      burner_year: vi?.burner?.year,
      burner_known_value: vi?.burner?.knownResaleCents !== undefined ? vi.burner.knownResaleCents / 100 : "",
      tanks: c.tanks,
      tank_material: t?.material,
      tank_capacity: t?.capacity,
      tank_quantity: t?.quantity,
      accessories: c.accessories,
      trailer: vi?.accessories?.some((a) => a.key === "trailer") ? "yes" : "",
      inflation_fan: vi?.accessories?.some((a) => a.key === "inflation_fan") ? "yes" : "",
      asking_price: c.askingPriceCents !== undefined ? c.askingPriceCents / 100 : "",
      sale_price: c.salePriceCents !== undefined ? c.salePriceCents / 100 : "",
      date_sold: c.dateSold,
      region: c.region,
      source: c.source,
      verification: c.verification,
      notes: c.notes,
    };
    lines.push(CSV_COLUMNS.map((k) => esc(row[k])).join(","));
  }
  return lines.join("\n") + "\n";
}

import type { StoredValuation, ValuationStatRow, ValuationStats } from "./types";

export function toStatRow(v: StoredValuation): ValuationStatRow {
  return {
    manufacturer: v.input.manufacturer,
    envelopeAge: v.result.envelopeAge,
    hours: v.input.scope === "envelope_only" || v.input.scope === "complete_system" ? (v.input.hours ?? null) : null,
    fairMarketValueCents: v.result.fairMarketValueCents,
    overpricingPct: v.result.asking?.percent ?? null,
    createdAt: v.createdAt,
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : null);

export function computeStats(rows: ValuationStatRow[], now = new Date()): ValuationStats {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.manufacturer, (counts.get(r.manufacturer) ?? 0) + 1);
  const ages = rows.map((r) => r.envelopeAge).filter((x): x is number => x !== null);
  const hours = rows.map((r) => r.hours).filter((x): x is number => x !== null);
  const over = rows.map((r) => r.overpricingPct).filter((x): x is number => x !== null);
  const cutoff = now.getTime() - 30 * 86400000;
  return {
    count: rows.length,
    averageValueCents: avg(rows.map((r) => r.fairMarketValueCents)),
    topManufacturers: [...counts.entries()]
      .map(([manufacturer, count]) => ({ manufacturer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    averageEnvelopeAge: avg(ages),
    averageEnvelopeHours: avg(hours),
    averageOverpricingPct: avg(over),
    askingSampleSize: over.length,
    last30Days: rows.filter((r) => new Date(r.createdAt).getTime() >= cutoff).length,
  };
}

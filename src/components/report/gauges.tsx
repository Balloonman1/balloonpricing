"use client";

import { formatUsd } from "@/lib/engine/math";

function niceStep(span: number): number {
  const raw = span / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

/**
 * Value altimeter: a vertical tape in the style of a balloon altimeter, showing the
 * selling range, the fair market value needle, the listing price and the asking price.
 */
export function ValueAltimeter({
  fmv,
  low,
  high,
  listing,
  asking,
  height = 320,
}: {
  fmv: number;
  low: number;
  high: number;
  listing: number;
  asking?: number | null;
  height?: number;
}) {
  const values = [fmv, low, high, listing, asking ?? 0].filter((v) => v > 0);
  const maxV = Math.max(...values, 100);
  const minV = Math.min(...values, maxV);
  const pad = Math.max((maxV - minV) * 0.25, maxV * 0.08);
  const top = maxV + pad;
  const bottom = Math.max(0, minV - pad);
  const step = niceStep(top - bottom);
  const y0 = 18;
  const y1 = height - 18;
  const y = (v: number) => y1 - ((v - bottom) / (top - bottom)) * (y1 - y0);
  const ticks: number[] = [];
  for (let t = Math.ceil(bottom / step) * step; t <= top; t += step) ticks.push(t);
  const minor: number[] = [];
  for (let t = Math.ceil(bottom / (step / 5)) * (step / 5); t <= top; t += step / 5) minor.push(t);

  const tapeX = 64;
  const tapeW = 26;
  const labelX = tapeX + tapeW + 18;

  type Mark = { v: number; label: string; sub: string; kind: "fmv" | "listing" | "asking" };
  const marks: Mark[] = [
    { v: fmv, label: formatUsd(fmv), sub: "Fair market value", kind: "fmv" as const },
    ...(listing > 0 && listing !== fmv ? [{ v: listing, label: formatUsd(listing), sub: "Recommended listing", kind: "listing" as const }] : []),
    ...(asking ? [{ v: asking, label: formatUsd(asking), sub: "Seller asking", kind: "asking" as const }] : []),
  ].sort((a, b) => b.v - a.v);
  // Keep labels from overlapping.
  const placed: number[] = [];
  const labelY = marks.map((m) => {
    let ly = y(m.v);
    for (const p of placed) if (Math.abs(ly - p) < 38) ly = p + 38;
    placed.push(ly);
    return Math.min(ly, y1 - 4);
  });

  return (
    <svg viewBox={`0 0 300 ${height}`} className="h-auto w-full max-w-[300px]" role="img" aria-label={`Fair market value ${formatUsd(fmv)}, selling range ${formatUsd(low)} to ${formatUsd(high)}${asking ? `, seller asking ${formatUsd(asking)}` : ""}`}>
      <rect x={tapeX} y={y0 - 8} width={tapeW} height={y1 - y0 + 16} rx="3" fill="#12243f" />
      {minor.map((t) => (
        <line key={`m${t}`} x1={tapeX} x2={tapeX + 6} y1={y(t)} y2={y(t)} stroke="#52698a" strokeWidth="1" />
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={tapeX} x2={tapeX + 12} y1={y(t)} y2={y(t)} stroke="#f6f2e8" strokeWidth="1.2" />
          <text x={tapeX - 8} y={y(t) + 4} textAnchor="end" className="tabular" fontSize="11" fill="#5a6576" fontFamily="IBM Plex Sans, sans-serif">
            {t >= 100000 ? `$${Math.round(t / 10000) / 10}K` : `$${Math.round(t / 100)}`}
          </text>
        </g>
      ))}
      {high > low && <rect x={tapeX + 14} y={y(high)} width={tapeW - 18} height={Math.max(2, y(low) - y(high))} rx="2" fill="#a98652" />}
      {marks.map((m, i) => {
        const my = y(m.v);
        const ly = labelY[i];
        const color = m.kind === "fmv" ? "#c05f2a" : m.kind === "listing" ? "#a98652" : "#12243f";
        return (
          <g key={m.kind} style={m.kind === "fmv" ? { animation: "needle-in 900ms cubic-bezier(.2,.8,.2,1) both", ["--from" as string]: "30px" } : undefined}>
            {m.kind === "fmv" ? (
              <path d={`M${tapeX + tapeW + 2} ${my} l10 -7 v14 z`} fill={color} />
            ) : m.kind === "asking" ? (
              <path d={`M${tapeX + tapeW + 8} ${my - 5} l5 5 l-5 5 l-5 -5 z`} fill="#fff" stroke={color} strokeWidth="1.6" />
            ) : (
              <line x1={tapeX + tapeW + 2} x2={tapeX + tapeW + 13} y1={my} y2={my} stroke={color} strokeWidth="2" />
            )}
            <line x1={tapeX} x2={tapeX + tapeW} y1={my} y2={my} stroke={color} strokeWidth={m.kind === "fmv" ? 2.4 : 1.4} strokeDasharray={m.kind === "listing" ? "3 2" : undefined} />
            {Math.abs(ly - my) > 2 && <line x1={tapeX + tapeW + 14} x2={labelX - 4} y1={my} y2={ly} stroke="#ddd5c3" strokeWidth="1" />}
            <text x={labelX} y={ly - 2} fontSize={m.kind === "fmv" ? 15 : 13} fontWeight={m.kind === "fmv" ? 600 : 500} fill="#12243f" className="tabular" fontFamily="IBM Plex Sans, sans-serif">
              {m.label}
            </text>
            <text x={labelX} y={ly + 13} fontSize="11" fill="#5a6576" fontFamily="IBM Plex Sans, sans-serif">
              {m.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal meter for age or hours, with a marker and reference ticks. */
export function Meter({
  value,
  max,
  label,
  valueLabel,
  note,
  ticks = [],
}: {
  value: number;
  max: number;
  label: string;
  valueLabel: string;
  note?: string;
  ticks?: { at: number; label: string }[];
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.93rem] font-medium">{label}</span>
        <span className="tabular text-[0.93rem]">{valueLabel}</span>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-ivory-deep" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-navy-900" style={{ width: `${pct * 100}%` }} />
        {ticks.map((t) => (
          <span key={t.label} className="absolute -top-1 h-4.5 w-px bg-gold" style={{ left: `${(t.at / max) * 100}%` }} />
        ))}
      </div>
      {ticks.length > 0 && (
        <div className="relative mt-1 h-4 text-[0.72rem] text-muted">
          {ticks.map((t) => (
            <span key={t.label} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(t.at / max) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      )}
      {note && <p className="mt-1.5 text-[0.82rem] text-muted">{note}</p>}
    </div>
  );
}

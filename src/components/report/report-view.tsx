"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { Badge, Panel } from "@/components/ui";
import { DISCLAIMER } from "@/components/site/disclaimer";
import { formatUsd, pct } from "@/lib/engine/math";
import type { ComponentResult, ValuationInput, ValuationResult } from "@/lib/engine/types";
import { cn } from "@/lib/cn";
import { ValueAltimeter, Meter } from "./gauges";
import { CLASSIFICATION_LABEL, CONFIDENCE_LABEL, CONFIDENCE_TEXT, detailSections, PROVENANCE_LABEL, reportTitle, SCOPE_LABEL } from "./labels";

export interface ReportData {
  referenceNumber: string;
  configVersion: number;
  engineVersion: string;
  createdAt: string;
  input: ValuationInput;
  result: ValuationResult;
}

const COMPONENT_COLOR: Record<ComponentResult["kind"], string> = {
  envelope: "#12243f",
  basket: "#a98652",
  burner: "#c05f2a",
  tanks: "#52698a",
  accessories: "#8b9a7f",
};

export function ReportView({ data, actions, banner }: { data: ReportData; actions?: ReactNode; banner?: ReactNode }) {
  const { input, result: r } = data;
  const date = new Date(r.valuationDate);
  const hasEnvelope = r.components.some((c) => c.kind === "envelope");
  const refHours = r.hoursConsumedPct !== null && input.hours ? input.hours / r.hoursConsumedPct : null;
  const critical = r.flags.filter((f) => f.severity === "critical");
  const assumptions = r.flags.filter((f) => f.severity === "assumption");
  const notes = r.flags.filter((f) => f.severity === "info");
  const total = r.components.reduce((n, c) => n + c.valueCents, 0);

  return (
    <article className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12">
      {banner}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            Valuation report <span className="tabular">{data.referenceNumber}</span>
          </p>
          <h1 className="mt-1 text-3xl sm:text-[2.6rem]">{reportTitle(input)}</h1>
          <p className="mt-1.5 text-muted">
            {SCOPE_LABEL[input.scope]}. Valued {date.toLocaleDateString("en-US", { dateStyle: "long" })}.
          </p>
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </header>

      {/* Headline value */}
      <Panel className="mt-8 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.25fr_1fr]">
          <div className="p-6 sm:p-9">
            <p className="text-[0.95rem] text-muted">Estimated fair market value</p>
            <p className="tabular mt-1 font-serif text-[3.4rem] leading-none text-ink sm:text-[4.4rem]">{formatUsd(r.fairMarketValueCents)}</p>
            <dl className="mt-8 grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">Reasonable selling range</dt>
                <dd className="tabular mt-1 text-lg font-medium">{r.fairMarketValueCents > 0 ? `${formatUsd(r.rangeLowCents)} to ${formatUsd(r.rangeHighCents)}` : "None"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Recommended listing price</dt>
                <dd className="tabular mt-1 text-lg font-medium">
                  {r.listingPriceCents > 0 ? formatUsd(r.listingPriceCents) : "Not recommended"}
                  {r.listingProvisional && <span className="ml-1.5 text-sm font-normal text-muted">provisional</span>}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Confidence</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Badge tone={r.confidence === "high" ? "sage" : r.confidence === "moderate" ? "gold" : "flame"}>{CONFIDENCE_LABEL[r.confidence]}</Badge>
                  <span className="tabular text-sm text-muted">±{Math.round(r.confidenceRangePct * 100)}%</span>
                </dd>
              </div>
            </dl>
            <p className="mt-6 max-w-lg text-[0.9rem] text-muted">
              {CONFIDENCE_TEXT[r.confidence]} The range reflects modeling uncertainty, not a statistical confidence interval. The listing price leaves room to negotiate and is not a measured market
              statistic.
            </p>
          </div>
          <div className="flex items-center justify-center border-t border-line-soft bg-ivory/60 p-6 md:border-l md:border-t-0">
            {r.fairMarketValueCents > 0 ? (
              <ValueAltimeter fmv={r.fairMarketValueCents} low={r.rangeLowCents} high={r.rangeHighCents} listing={r.listingPriceCents} asking={r.asking?.askingCents} />
            ) : (
              <p className="max-w-xs text-center text-muted">No recommended resale value under the applicable policy. Component values are shown below.</p>
            )}
          </div>
        </div>
      </Panel>

      {(r.legacyMessage || r.brandMessage || r.policies.length > 0) && (
        <section aria-labelledby="policy-h" className="mt-6 rounded-[var(--radius-panel)] border border-gold/50 bg-gold-soft/60 p-5 sm:p-6">
          <h2 id="policy-h" className="font-sans text-base font-semibold">
            Resale policy applied
          </h2>
          {r.legacyMessage && <p className="mt-2">{r.legacyMessage}</p>}
          {r.brandMessage && r.brandMessage !== r.legacyMessage && <p className="mt-2">{r.brandMessage}</p>}
          <ul className="mt-3 space-y-1.5 text-[0.92rem] text-[#5f4a2a]">
            {r.policies.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
          {r.separateComponentValueCents !== null && (
            <p className="mt-3 text-[0.95rem]">
              Reusable hardware listed below is worth about <strong className="tabular">{formatUsd(r.separateComponentValueCents)}</strong> on its own. That amount is shown separately and is not part
              of the system value.
            </p>
          )}
          <p className="mt-3 text-[0.82rem] text-[#6f5631]">Resale policies are commercial valuation preferences. They are not regulatory restrictions or airworthiness findings.</p>
        </section>
      )}

      {r.asking && <AskingSection r={r} />}

      {/* Components */}
      <section aria-labelledby="components-h" className="mt-12">
        <h2 id="components-h" className="text-2xl">
          Component breakdown
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Panel className="p-2 sm:p-4">
            <table className="w-full text-[0.95rem]">
              <thead>
                <tr className="text-left text-sm text-muted">
                  <th className="px-3 py-2 font-normal">Component</th>
                  <th className="px-3 py-2 font-normal">Basis</th>
                  <th className="px-3 py-2 text-right font-normal">Estimated value</th>
                </tr>
              </thead>
              <tbody>
                {r.components.map((c) => (
                  <tr key={c.kind} className="border-t border-line-soft align-top">
                    <td className="px-3 py-3">
                      <span className="flex items-start gap-2.5">
                        <span className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ background: COMPONENT_COLOR[c.kind] }} aria-hidden="true" />
                        <span>
                          {c.label}
                          {c.lines && (
                            <span className="mt-1 block space-y-0.5 text-[0.82rem] text-muted">
                              {c.lines.map((l, i) => (
                                <span key={i} className="block">
                                  {l.label}: <span className="tabular">{formatUsd(l.displayCents)}</span>
                                </span>
                              ))}
                            </span>
                          )}
                          {c.conditionalAlternativeCents && (
                            <span className="mt-1 block text-[0.82rem] text-flame-deep">
                              {c.conditionalAlternativeCents.label}:{" "}
                              <span className="tabular">
                                {c.conditionalAlternativeCents.minCents === c.conditionalAlternativeCents.maxCents
                                  ? formatUsd(c.conditionalAlternativeCents.minCents)
                                  : `${formatUsd(c.conditionalAlternativeCents.minCents)} to ${formatUsd(c.conditionalAlternativeCents.maxCents)}`}
                              </span>
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted">{PROVENANCE_LABEL[c.provenance]}</td>
                    <td className="tabular px-3 py-3 text-right">{formatUsd(c.displayCents)}</td>
                  </tr>
                ))}
                {r.components.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted">
                      No components entered.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-navy-900">
                  <td className="px-3 py-3 font-medium" colSpan={2}>
                    Calculated total
                    {r.marketAdjustmentFactor !== 1 && <span className="block text-sm font-normal text-muted">Market adjustment ×{r.marketAdjustmentFactor.toFixed(3)} applied</span>}
                  </td>
                  <td className="tabular px-3 py-3 text-right font-medium">{formatUsd(Math.round(r.adjustedTotalCents / 5000) * 5000)}</td>
                </tr>
                {r.policies.length > 0 && (
                  <tr>
                    <td className="px-3 pb-3 text-sm text-muted" colSpan={2}>
                      After resale policy
                    </td>
                    <td className="tabular px-3 pb-3 text-right font-medium">{formatUsd(r.fairMarketValueCents)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
            <p className="px-3 pb-2 pt-1 text-[0.8rem] text-muted">Component values are rounded to the nearest $50. Totals are calculated at full precision.</p>
          </Panel>
          {total > 0 && <ComponentChart components={r.components} total={total} />}
        </div>
      </section>

      {/* Age and hours */}
      {hasEnvelope && r.envelopeAge !== null && (
        <section aria-labelledby="life-h" className="mt-12">
          <h2 id="life-h" className="text-2xl">
            Envelope age and hours
          </h2>
          <Panel className="mt-5 grid gap-8 p-6 sm:grid-cols-2 sm:p-8">
            <Meter
              label="Envelope age"
              value={r.envelopeAge}
              max={40}
              valueLabel={`${r.envelopeAge} years · ${pct(r.ageDepreciationPct ?? 0)} depreciation`}
              ticks={[
                { at: 20, label: "20" },
                { at: 30, label: "30" },
                { at: 35, label: "35" },
              ]}
              note="Depreciation steepens after 20 years. Policy limits apply after 30."
            />
            {r.hoursConsumedPct !== null && refHours && (
              <Meter
                label="Reference hours used"
                value={Math.min(r.hoursConsumedPct, 1) * 100}
                max={100}
                valueLabel={`${input.hours?.toLocaleString("en-US")} of ${Math.round(refHours)} h · ${pct(Math.min(1, r.hoursConsumedPct))}`}
                note="An economic reference life for valuation, not a manufacturer service limit."
              />
            )}
            <p className="text-[0.85rem] text-muted sm:col-span-2">
              These measures describe economic depreciation only. They say nothing about airworthiness, which is determined by inspection and the applicable regulations.
            </p>
          </Panel>
        </section>
      )}

      {/* Assumptions */}
      {(critical.length > 0 || assumptions.length > 0 || notes.length > 0) && (
        <section aria-labelledby="assume-h" className="mt-12">
          <h2 id="assume-h" className="text-2xl">
            What this estimate assumes
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <FlagList title="Needs your input" tone="flame" items={critical.map((f) => f.message)} empty="Nothing essential is missing." />
            <FlagList title="Assumptions used" tone="gold" items={assumptions.map((f) => f.message)} empty="No provisional assumptions." />
            <FlagList title="Notes" tone="neutral" items={notes.map((f) => f.message)} empty="No additional notes." />
          </div>
          <p className="mt-3 text-[0.85rem] text-muted">Logbooks are assumed complete for pricing. This report does not verify logbooks, inspections or ownership records.</p>
        </section>
      )}

      {/* Method */}
      <section aria-labelledby="method-h" className="mt-12">
        <details className="group rounded-[var(--radius-panel)] border border-line bg-paper" open={false}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
            <h2 id="method-h" className="text-2xl">
              How we calculated this value
            </h2>
            <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">
              <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </summary>
          <div className="border-t border-line-soft px-5 pb-6 sm:px-6">
            {r.components.map((c) => (
              <div key={c.kind} className="mt-6">
                <h3 className="font-sans text-base font-semibold">{c.label}</h3>
                <ol className="mt-2 divide-y divide-line-soft border-y border-line-soft text-[0.92rem]">
                  {c.steps.map((s, i) => (
                    <li key={i} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2.5">
                      <span>
                        {s.label}
                        {s.kind === "multiply" && s.factor !== undefined && <span className="tabular ml-2 text-muted">×{s.factor.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}</span>}
                      </span>
                      <span className="tabular text-right">{s.kind === "info" ? "" : formatUsd(s.valueCents, { cents: true })}</span>
                      {s.detail && <span className="col-span-2 text-[0.84rem] text-muted">{s.detail}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            <div className="mt-6 text-[0.9rem] text-muted">
              <p>
                The calculated total is the sum of the components at full precision{r.marketAdjustmentFactor !== 1 ? ", multiplied by the market adjustment" : ""}. Resale policies are applied next,
                then the fair market value is rounded to the nearest $50. The listing price is the fair market value plus the configured listing markup, rounded to the nearest $100 and never above an
                applicable policy maximum.
              </p>
              <p className="mt-2">
                Pricing configuration v{data.configVersion}, engine {data.engineVersion}. The report can be reproduced exactly from these versions.
              </p>
            </div>
          </div>
        </details>
      </section>

      {/* Details */}
      <section aria-labelledby="details-h" className="mt-12">
        <h2 id="details-h" className="text-2xl">
          Equipment details
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {detailSections(input).map((s) => (
            <Panel key={s.title} className="p-5">
              <h3 className="font-sans text-[0.95rem] font-semibold">{s.title}</h3>
              <dl className="mt-2 divide-y divide-line-soft text-[0.92rem]">
                {s.rows.map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 py-1.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
        </div>
      </section>

      <p className="mt-12 border-t border-line pt-6 text-[0.8rem] leading-relaxed text-muted">{DISCLAIMER}</p>
    </article>
  );
}

function AskingSection({ r }: { r: ValuationResult }) {
  const a = r.asking!;
  const sign = a.percent !== null && a.percent >= 0 ? "+" : "";
  return (
    <section aria-labelledby="asking-h" className="mt-12">
      <h2 id="asking-h" className="text-2xl">
        Asking price comparison
      </h2>
      <Panel className="mt-5 p-6 sm:p-8">
        <dl className="grid gap-6 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted">Seller asking</dt>
            <dd className="tabular mt-1 text-xl font-medium">{formatUsd(a.askingCents)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Estimated fair value</dt>
            <dd className="tabular mt-1 text-xl font-medium">{formatUsd(a.fairValueCents)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Difference</dt>
            <dd className="tabular mt-1 text-xl font-medium">
              {a.differenceCents >= 0 ? "+" : "−"}
              {formatUsd(Math.abs(a.differenceCents))}
              {a.percent !== null && (
                <span className="ml-2 text-base text-muted">
                  {sign}
                  {a.percent.toFixed(1)}%
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Classification</dt>
            <dd className="mt-1.5">
              <Badge tone={a.classification === "within" ? "sage" : a.classification === "bargain" ? "navy" : a.classification === "not_applicable" ? "neutral" : "flame"}>
                {CLASSIFICATION_LABEL[a.classification]}
              </Badge>
            </dd>
          </div>
        </dl>
        {a.percent !== null && <AskingScale percent={a.percent} />}
        <p className="mt-5 max-w-2xl">{a.message}</p>
        {a.classification !== "not_applicable" && (
          <p className="mt-2 text-[0.95rem] text-muted">
            Suggested negotiation range: <span className="tabular font-medium text-ink">{formatUsd(a.negotiationLowCents)}</span> to{" "}
            <span className="tabular font-medium text-ink">{formatUsd(a.negotiationHighCents)}</span>
          </p>
        )}
      </Panel>
    </section>
  );
}

/** Position of the asking price across the classification bands. */
function AskingScale({ percent }: { percent: number }) {
  const min = -40;
  const max = 60;
  const at = (p: number) => ((Math.max(min, Math.min(max, p)) - min) / (max - min)) * 100;
  const bands = [
    { from: min, to: -15, label: "Bargain", cls: "bg-navy-700/15" },
    { from: -15, to: 15, label: "Within tolerance", cls: "bg-sage-soft" },
    { from: 15, to: 30, label: "Overpriced", cls: "bg-flame-soft" },
    { from: 30, to: max, label: "Significantly overpriced", cls: "bg-flame/25" },
  ];
  return (
    <div className="mt-7" aria-hidden="true">
      <div className="relative h-3 overflow-hidden rounded-full">
        {bands.map((b) => (
          <span key={b.label} className={cn("absolute inset-y-0", b.cls)} style={{ left: `${at(b.from)}%`, width: `${at(b.to) - at(b.from)}%` }} />
        ))}
      </div>
      <div className="relative h-0">
        <span className="absolute -top-[18px] h-6 w-[3px] -translate-x-1/2 rounded bg-navy-900" style={{ left: `${at(percent)}%` }} />
      </div>
      <div className="relative mt-2 h-4 text-[0.72rem] text-muted">
        {bands.map((b) => (
          <span key={b.label} className="absolute -translate-x-1/2 whitespace-nowrap max-sm:hidden" style={{ left: `${(at(b.from) + at(b.to)) / 2}%` }}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ComponentChart({ components, total }: { components: ComponentResult[]; total: number }) {
  const data = components.map((c) => ({
    name: c.kind.charAt(0).toUpperCase() + c.kind.slice(1),
    value: c.valueCents / 100,
    share: c.valueCents / total,
    kind: c.kind,
  }));
  return (
    <Panel className="p-5 sm:p-6">
      <h3 className="font-sans text-[0.95rem] font-semibold">Share of total value</h3>
      <div className="mt-3" style={{ height: Math.max(140, data.length * 52) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={14}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fill: "#5a6576", fontSize: 13, fontFamily: "IBM Plex Sans" }} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.kind} fill={COMPONENT_COLOR[d.kind]} />
              ))}
              <LabelList dataKey="share" position="right" formatter={(v: unknown) => pct(Number(v))} style={{ fill: "#12243f", fontSize: 13, fontFamily: "IBM Plex Sans" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function FlagList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "flame" | "gold" | "neutral" }) {
  const dot = { flame: "bg-flame", gold: "bg-gold", neutral: "bg-navy-500" }[tone];
  return (
    <Panel className="p-5">
      <h3 className="flex items-center gap-2 font-sans text-[0.95rem] font-semibold">
        <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" />
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-3 space-y-2.5 text-[0.9rem]">
          {items.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[0.9rem] text-muted">{empty}</p>
      )}
    </Panel>
  );
}

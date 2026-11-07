"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button, Field, MoneyInput, NumberInput, Panel, Select, TextInput } from "@/components/ui";
import { formatUsd } from "@/lib/engine/math";
import type { BalloonCategory, BrandPolicy, Condition, ValuationConfig } from "@/lib/engine/types";
import { cn } from "@/lib/cn";

type Tab = "envelope" | "depreciation" | "equipment" | "rules";
const TABS: { key: Tab; label: string }[] = [
  { key: "envelope", label: "Envelope pricing" },
  { key: "depreciation", label: "Depreciation" },
  { key: "equipment", label: "Equipment" },
  { key: "rules", label: "Special rules" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Percent input over a 0..1 fraction. */
function PercentInput({ value, onValue, label }: { value: number; onValue: (v: number) => void; label: string }) {
  return <NumberInput aria-label={label} decimals value={Math.round(value * 10000) / 100} onValue={(v) => onValue((v ?? 0) / 100)} suffix="%" />;
}

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 max-w-3xl text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Panel>
  );
}

export function PricingEditor({ initial }: { initial: ValuationConfig }) {
  const router = useRouter();
  const [c, setC] = useState<ValuationConfig>(initial);
  const [tab, setTab] = useState<Tab>("envelope");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string; issues?: { path: string; message: string }[] } | null>(null);
  const [preview, setPreview] = useState<{ rows: { name: string; beforeCents: number; afterCents: number }[]; activeVersion: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(c) !== JSON.stringify(initial);

  const up = (patch: Partial<ValuationConfig>) => {
    setC((x) => ({ ...x, ...patch }));
    setPreview(null);
  };

  async function runPreview() {
    setBusy(true);
    const res = await fetch("/api/admin/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: c }) });
    setBusy(false);
    const body = await res.json();
    if (res.ok) setPreview(body);
    else setStatus({ kind: "error", text: body.error, issues: body.issues });
  }

  async function save() {
    if (!label.trim()) return setStatus({ kind: "error", text: "Describe the change in a few words before saving." });
    setBusy(true);
    const res = await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: c, label, notes }) });
    setBusy(false);
    const body = await res.json();
    if (res.ok) {
      setStatus({ kind: "ok", text: `Saved as version ${body.config.version} and made active. Earlier reports keep the version they used.` });
      setLabel("");
      setNotes("");
      router.refresh();
    } else setStatus({ kind: "error", text: body.error, issues: body.issues });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Pricing rules</h1>
          <p className="mt-2 max-w-2xl text-muted">Editing version {initial.version}. Saving creates a new version; nothing already saved is changed.</p>
        </div>
      </div>

      <div role="tablist" aria-label="Pricing sections" className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-[0.95rem]", tab === t.key ? "border-flame font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {tab === "envelope" && (
          <>
            <Section title="Replacement cost by volume" hint="New-equivalent envelope prices. Values between rows are interpolated linearly; values outside are extrapolated and flagged.">
              <table className="w-full max-w-xl text-[0.95rem]">
                <thead>
                  <tr className="text-left text-sm text-muted">
                    <th className="pb-2 font-normal">Volume (cu ft)</th>
                    <th className="pb-2 font-normal">New price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.envelopePrices.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-3">
                        <NumberInput aria-label="Volume" value={p.volumeCuFt} onValue={(v) => up({ envelopePrices: c.envelopePrices.map((x, j) => (j === i ? { ...x, volumeCuFt: v ?? 0 } : x)) })} />
                      </td>
                      <td className="py-1 pr-3">
                        <MoneyInput cents={p.priceCents} onCents={(v) => up({ envelopePrices: c.envelopePrices.map((x, j) => (j === i ? { ...x, priceCents: v ?? 0 } : x)) })} />
                      </td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => up({ envelopePrices: c.envelopePrices.filter((_, j) => j !== i) })} disabled={c.envelopePrices.length <= 1}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => up({ envelopePrices: [...c.envelopePrices, { volumeCuFt: 140000, priceCents: 0 }] })}>
                Add volume
              </Button>
            </Section>
            <Section title="Category references">
              <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
                <Field label="Racer envelope">
                  <MoneyInput cents={c.racerEnvelopeCents} onCents={(v) => up({ racerEnvelopeCents: v ?? 0 })} />
                </Field>
                <Field label="Special-shape envelope">
                  <MoneyInput cents={c.specialShapeEnvelopeCents} onCents={(v) => up({ specialShapeEnvelopeCents: v ?? 0 })} />
                </Field>
                <Field label="Flag as large above" hint="Volumes above this need a known replacement cost">
                  <NumberInput value={c.largeBalloonThresholdCuFt} onValue={(v) => up({ largeBalloonThresholdCuFt: v ?? 0 })} suffix="cu ft" />
                </Field>
              </div>
            </Section>
            <Section title="Manufacturer-specific envelope pricing" hint="When set, these references replace the generic table for that manufacturer.">
              {c.manufacturerEnvelopePrices.length === 0 && <p className="text-sm text-muted">None configured.</p>}
              {c.manufacturerEnvelopePrices.map((m, mi) => (
                <div key={mi} className="mb-4 rounded-md border border-line-soft p-4">
                  <div className="flex items-end gap-3">
                    <Field label="Manufacturer" className="flex-1">
                      <TextInput value={m.manufacturer} onChange={(e) => up({ manufacturerEnvelopePrices: c.manufacturerEnvelopePrices.map((x, j) => (j === mi ? { ...x, manufacturer: e.target.value } : x)) })} />
                    </Field>
                    <Button variant="ghost" size="sm" onClick={() => up({ manufacturerEnvelopePrices: c.manufacturerEnvelopePrices.filter((_, j) => j !== mi) })}>
                      Remove
                    </Button>
                  </div>
                  {m.points.map((p, pi) => (
                    <div key={pi} className="mt-2 grid max-w-xl grid-cols-[1fr_1fr_auto] gap-3">
                      <NumberInput aria-label="Volume" value={p.volumeCuFt} onValue={(v) => up({ manufacturerEnvelopePrices: c.manufacturerEnvelopePrices.map((x, j) => (j === mi ? { ...x, points: x.points.map((q, k) => (k === pi ? { ...q, volumeCuFt: v ?? 0 } : q)) } : x)) })} suffix="cu ft" />
                      <MoneyInput cents={p.priceCents} onCents={(v) => up({ manufacturerEnvelopePrices: c.manufacturerEnvelopePrices.map((x, j) => (j === mi ? { ...x, points: x.points.map((q, k) => (k === pi ? { ...q, priceCents: v ?? 0 } : q)) } : x)) })} />
                      <Button variant="ghost" size="sm" onClick={() => up({ manufacturerEnvelopePrices: c.manufacturerEnvelopePrices.map((x, j) => (j === mi ? { ...x, points: x.points.filter((_, k) => k !== pi) } : x)) })}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" className="mt-2" onClick={() => up({ manufacturerEnvelopePrices: c.manufacturerEnvelopePrices.map((x, j) => (j === mi ? { ...x, points: [...x.points, { volumeCuFt: 90000, priceCents: 0 }] } : x)) })}>
                    Add volume
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => up({ manufacturerEnvelopePrices: [...c.manufacturerEnvelopePrices, { manufacturer: "", points: [{ volumeCuFt: 90000, priceCents: 0 }] }] })}>
                Add manufacturer pricing
              </Button>
            </Section>
          </>
        )}

        {tab === "depreciation" && (
          <>
            <Section title="Economic reference hours" hint="Valuation assumptions only, not manufacturer service-life limits.">
              <div className="grid max-w-3xl gap-4 sm:grid-cols-4">
                {(["sport", "commercial", "racer", "special_shape"] as BalloonCategory[]).map((k) => (
                  <Field key={k} label={{ sport: "Sport", commercial: "Commercial", racer: "Racer", special_shape: "Special shape" }[k]}>
                    <NumberInput value={c.referenceHours[k]} onValue={(v) => up({ referenceHours: { ...c.referenceHours, [k]: v ?? 1 } })} suffix="h" />
                  </Field>
                ))}
              </div>
            </Section>
            <Section title="Envelope age curve" hint="Depreciation by age. Ages between rows are interpolated. Ages beyond the last row use the last value.">
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {c.envelopeAgeCurve.map((p, i) => (
                  <div key={i} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2">
                    <NumberInput aria-label="Age" value={p.age} onValue={(v) => up({ envelopeAgeCurve: c.envelopeAgeCurve.map((x, j) => (j === i ? { ...x, age: v ?? 0 } : x)) })} suffix="yr" />
                    <PercentInput label={`Depreciation at ${p.age} years`} value={p.depreciation} onValue={(v) => up({ envelopeAgeCurve: c.envelopeAgeCurve.map((x, j) => (j === i ? { ...x, depreciation: v } : x)) })} />
                    <Button variant="ghost" size="sm" aria-label="Remove row" onClick={() => up({ envelopeAgeCurve: c.envelopeAgeCurve.filter((_, j) => j !== i) })}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => up({ envelopeAgeCurve: [...c.envelopeAgeCurve, { age: 0, depreciation: 0 }].sort((a, b) => a.age - b.age) })}>
                Add age
              </Button>
            </Section>
            <Section title="Basket and generic burner age schedule" hint="Remaining value from each minimum age upward.">
              <div className="grid max-w-3xl gap-2 sm:grid-cols-2">
                {c.hardwareAgeBands.map((b, i) => (
                  <div key={i} className="grid grid-cols-[6rem_1fr_auto] items-center gap-2">
                    <NumberInput aria-label="From age" value={b.minAge} onValue={(v) => up({ hardwareAgeBands: c.hardwareAgeBands.map((x, j) => (j === i ? { ...x, minAge: v ?? 0 } : x)) })} suffix="yr+" />
                    <PercentInput label="Remaining value" value={b.remaining} onValue={(v) => up({ hardwareAgeBands: c.hardwareAgeBands.map((x, j) => (j === i ? { ...x, remaining: v } : x)) })} />
                    <Button variant="ghost" size="sm" aria-label="Remove band" onClick={() => up({ hardwareAgeBands: c.hardwareAgeBands.filter((_, j) => j !== i) })}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => up({ hardwareAgeBands: [...c.hardwareAgeBands, { minAge: 20, remaining: 0.3 }] })}>
                Add band
              </Button>
            </Section>
            <Section title="Condition multipliers">
              <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
                {(["A", "B", "C", "D", "E"] as Condition[]).map((k) => (
                  <Field key={k} label={k}>
                    <NumberInput decimals value={c.conditionMultipliers[k]} onValue={(v) => up({ conditionMultipliers: { ...c.conditionMultipliers, [k]: v ?? 1 } })} suffix="×" />
                  </Field>
                ))}
              </div>
            </Section>
            <Section title="Fabric multipliers">
              <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
                {(["polyester", "nylon", "hyperlast", "unknown"] as const).map((k) => (
                  <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                    <NumberInput decimals value={c.fabricMultipliers[k]} onValue={(v) => up({ fabricMultipliers: { ...c.fabricMultipliers, [k]: v ?? 1 } })} suffix="×" />
                  </Field>
                ))}
              </div>
            </Section>
            <Section title="Appearance deductions" hint="Color and branding deductions do not stack; the larger one applies, up to the maximum.">
              <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-5">
                {(
                  [
                    ["warm", "Warm colors"],
                    ["neutral", "Neutral"],
                    ["unattractive", "Unattractive"],
                    ["heavyBranding", "Heavy branding"],
                    ["maxCombined", "Maximum"],
                  ] as const
                ).map(([k, l]) => (
                  <Field key={k} label={l}>
                    <PercentInput label={l} value={c.appearanceDeductions[k]} onValue={(v) => up({ appearanceDeductions: { ...c.appearanceDeductions, [k]: v } })} />
                  </Field>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === "equipment" && (
          <>
            <Section title="Generic hardware references" hint="Provisional allocation of the basket-and-burner new reference. Specific models override these.">
              <div className="grid max-w-xl gap-4 sm:grid-cols-2">
                <Field label="Basket new-equivalent">
                  <MoneyInput cents={c.basketNewCents} onCents={(v) => up({ basketNewCents: v ?? 0 })} />
                </Field>
                <Field label="Burner new-equivalent">
                  <MoneyInput cents={c.burnerNewCents} onCents={(v) => up({ burnerNewCents: v ?? 0 })} />
                </Field>
              </div>
            </Section>
            <Section title="Burner models" hint="Used-market values, applied without age depreciation. Leave the price blank when no verified price exists; the generic estimate is used and flagged. Glow and non-Glow are separate entries.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[0.93rem]">
                  <thead>
                    <tr className="text-left text-sm text-muted">
                      <th className="pb-2 font-normal">Manufacturer</th>
                      <th className="pb-2 font-normal">Model</th>
                      <th className="pb-2 font-normal">Glow</th>
                      <th className="pb-2 font-normal">Used value</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {c.burnerModels.map((b, i) => {
                      const set = (patch: Partial<typeof b>) => up({ burnerModels: c.burnerModels.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                      return (
                        <tr key={b.id}>
                          <td className="py-1 pr-2">
                            <TextInput aria-label="Manufacturer" value={b.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} />
                          </td>
                          <td className="py-1 pr-2">
                            <TextInput aria-label="Model" value={b.model} onChange={(e) => set({ model: e.target.value })} />
                          </td>
                          <td className="py-1 pr-2">
                            <Select aria-label="Glow" value={b.glow} onChange={(e) => set({ glow: e.target.value as typeof b.glow })}>
                              <option value="any">Any</option>
                              <option value="non_glow">Non-Glow</option>
                              <option value="glow">Glow</option>
                            </Select>
                          </td>
                          <td className="py-1 pr-2">
                            <MoneyInput cents={b.usedValueCents ?? undefined} onCents={(v) => set({ usedValueCents: v ?? null })} placeholder="No verified price" />
                          </td>
                          <td>
                            <Button variant="ghost" size="sm" onClick={() => up({ burnerModels: c.burnerModels.filter((_, j) => j !== i) })}>
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => up({ burnerModels: [...c.burnerModels, { id: `burner-${Date.now()}`, manufacturer: "", model: "", glow: "any", usedValueCents: null }] })}>
                Add burner
              </Button>
            </Section>
            <Section title="Basket models" hint="New-equivalent reference prices. Blank uses the generic basket reference. Baskets are depreciated by their own age.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[0.93rem]">
                  <thead>
                    <tr className="text-left text-sm text-muted">
                      <th className="pb-2 font-normal">Manufacturer</th>
                      <th className="pb-2 font-normal">Model</th>
                      <th className="pb-2 font-normal">New reference</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {c.basketModels.map((b, i) => {
                      const set = (patch: Partial<typeof b>) => up({ basketModels: c.basketModels.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                      return (
                        <tr key={b.id}>
                          <td className="py-1 pr-2">
                            <TextInput aria-label="Manufacturer" value={b.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} />
                          </td>
                          <td className="py-1 pr-2">
                            <TextInput aria-label="Model" value={b.model} onChange={(e) => set({ model: e.target.value })} />
                          </td>
                          <td className="py-1 pr-2">
                            <MoneyInput cents={b.newPriceCents ?? undefined} onCents={(v) => set({ newPriceCents: v ?? null })} placeholder="Generic reference" />
                          </td>
                          <td>
                            <Button variant="ghost" size="sm" onClick={() => up({ basketModels: c.basketModels.filter((_, j) => j !== i) })}>
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => up({ basketModels: [...c.basketModels, { id: `basket-${Date.now()}`, manufacturer: "", model: "", newPriceCents: null }] })}>
                Add basket
              </Button>
            </Section>
            <Section title="Fuel tank values" hint="Used-market values per tank. Not depreciated.">
              <div className="grid max-w-3xl gap-4 sm:grid-cols-4">
                <Field label="Aluminum, any size">
                  <MoneyInput cents={c.tankPrices.aluminumCents} onCents={(v) => up({ tankPrices: { ...c.tankPrices, aluminumCents: v ?? 0 } })} />
                </Field>
                {(["10", "15", "20"] as const).map((k) => (
                  <Field key={k} label={`Steel, ${k} gal`}>
                    <MoneyInput cents={c.tankPrices.steel[k]} onCents={(v) => up({ tankPrices: { ...c.tankPrices, steel: { ...c.tankPrices.steel, [k]: v ?? 0 } } })} />
                  </Field>
                ))}
              </div>
            </Section>
            <Section title="Accessories and envelope features" hint="Blank means no reference price: accessories need a user estimate, features add nothing.">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  {c.accessories.map((a, i) => (
                    <div key={a.key} className="grid grid-cols-[1fr_10rem] items-center gap-3">
                      <span>{a.label}</span>
                      <MoneyInput cents={a.usedValueCents ?? undefined} onCents={(v) => up({ accessories: c.accessories.map((x, j) => (j === i ? { ...x, usedValueCents: v ?? null } : x)) })} placeholder="No reference" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  {c.features.map((f, i) => (
                    <div key={f.key} className="grid grid-cols-[1fr_10rem] items-center gap-3">
                      <span>{f.label}</span>
                      <MoneyInput cents={f.adjustmentCents ?? undefined} onCents={(v) => up({ features: c.features.map((x, j) => (j === i ? { ...x, adjustmentCents: v ?? null } : x)) })} placeholder="No adjustment" />
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === "rules" && (
          <>
            <Section title="Age policy" hint="Applied to complete systems and envelopes, never to standalone hardware. A commercial valuation policy, not an airworthiness rule.">
              <div className="grid max-w-3xl gap-4 sm:grid-cols-4">
                <Field label="Cap from age">
                  <NumberInput value={c.agePolicy.capStartAge} onValue={(v) => up({ agePolicy: { ...c.agePolicy, capStartAge: v ?? 0 } })} suffix="yr" />
                </Field>
                <Field label="Cap to age">
                  <NumberInput value={c.agePolicy.capEndAge} onValue={(v) => up({ agePolicy: { ...c.agePolicy, capEndAge: v ?? 0 } })} suffix="yr" />
                </Field>
                <Field label="Cap amount">
                  <MoneyInput cents={c.agePolicy.capMaxCents} onCents={(v) => up({ agePolicy: { ...c.agePolicy, capMaxCents: v ?? 0 } })} />
                </Field>
                <Field label="Legacy ($0) after age">
                  <NumberInput value={c.agePolicy.legacyAfterAge} onValue={(v) => up({ agePolicy: { ...c.agePolicy, legacyAfterAge: v ?? 0 } })} suffix="yr" />
                </Field>
              </div>
            </Section>
            <Section title="Manufacturer rules" hint="Caps or $0 recommendations applied after component values are calculated.">
              <div className="flex flex-col gap-3">
                {c.brandPolicies.map((p, i) => {
                  const set = (patch: Partial<BrandPolicy>) => up({ brandPolicies: c.brandPolicies.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <div key={p.id} className="rounded-md border border-line-soft p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                        <Field label="Manufacturer">
                          <TextInput value={p.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} />
                        </Field>
                        <Field label="Rule">
                          <Select value={p.kind} onChange={(e) => set({ kind: e.target.value as BrandPolicy["kind"] })}>
                            <option value="cap">Maximum value</option>
                            <option value="zero">$0, recommend gifting</option>
                          </Select>
                        </Field>
                        <label className="flex items-center gap-2 self-end pb-3 text-sm">
                          <input type="checkbox" checked={p.active} onChange={(e) => set({ active: e.target.checked })} /> Active
                        </label>
                      </div>
                      {p.kind === "cap" && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <Field label="Maximum">
                            <MoneyInput cents={p.maxValueCents} onCents={(v) => set({ maxValueCents: v })} />
                          </Field>
                          <Field label="Typical from" optional>
                            <MoneyInput cents={p.typicalMinCents} onCents={(v) => set({ typicalMinCents: v })} />
                          </Field>
                          <Field label="Typical to" optional>
                            <MoneyInput cents={p.typicalMaxCents} onCents={(v) => set({ typicalMaxCents: v })} />
                          </Field>
                        </div>
                      )}
                      <Field label="Also applies to" optional hint="Other names for the same company, separated by commas" className="mt-3">
                        <TextInput
                          defaultValue={(p.aliases ?? []).join(", ")}
                          onBlur={(e) =>
                            set({
                              aliases: e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </Field>
                      <Field label="Message shown on reports" className="mt-3">
                        <TextInput value={p.message ?? ""} onChange={(e) => set({ message: e.target.value })} />
                      </Field>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => up({ brandPolicies: c.brandPolicies.filter((_, j) => j !== i) })}>
                        Remove rule
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => up({ brandPolicies: [...c.brandPolicies, { id: `policy-${slug(String(Date.now()))}`, manufacturer: "", kind: "cap", active: true }] })}>
                Add manufacturer rule
              </Button>
            </Section>
            <Section title="Listing, market and confidence">
              <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
                <Field label="Listing markup" hint="Added to fair market value for the listing price">
                  <PercentInput label="Listing markup" value={c.listingMarkup} onValue={(v) => up({ listingMarkup: v })} />
                </Field>
                <Field label="Market adjustment" hint="Applied to all valuations. 0% for none.">
                  <PercentInput label="Market adjustment" value={c.marketAdjustment} onValue={(v) => up({ marketAdjustment: v })} />
                </Field>
                <Field label="Verified sales needed for High confidence">
                  <NumberInput value={c.minVerifiedComparablesForHigh} onValue={(v) => up({ minVerifiedComparablesForHigh: Math.max(1, v ?? 1) })} />
                </Field>
                {(["high", "moderate", "low"] as const).map((k) => (
                  <Field key={k} label={`${k.charAt(0).toUpperCase() + k.slice(1)} confidence range`}>
                    <PercentInput label={`${k} range`} value={c.confidenceRanges[k]} onValue={(v) => up({ confidenceRanges: { ...c.confidenceRanges, [k]: v } })} />
                  </Field>
                ))}
              </div>
              <div className="mt-6">
                <p className="text-[0.93rem] font-medium">Manufacturer adjustments</p>
                <p className="text-sm text-muted">Multipliers approved from calibration. 1.00 means no change.</p>
                <div className="mt-2 flex flex-col gap-2">
                  {Object.entries(c.manufacturerAdjustments).map(([m, v]) => (
                    <div key={m} className="grid max-w-md grid-cols-[1fr_8rem_auto] items-center gap-3">
                      <span>{m}</span>
                      <NumberInput decimals value={v} onValue={(n) => up({ manufacturerAdjustments: { ...c.manufacturerAdjustments, [m]: n ?? 1 } })} suffix="×" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = { ...c.manufacturerAdjustments };
                          delete next[m];
                          up({ manufacturerAdjustments: next });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {Object.keys(c.manufacturerAdjustments).length === 0 && <p className="text-sm text-muted">None.</p>}
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 z-10 mt-8 border-t border-line bg-ivory/95 py-4 backdrop-blur">
        {preview && (
          <Panel className="mb-4 p-4">
            <p className="text-sm font-medium">Effect on reference cases (active v{preview.activeVersion} → draft)</p>
            <table className="mt-2 w-full text-[0.9rem]">
              <tbody>
                {preview.rows.map((r) => {
                  const d = r.afterCents - r.beforeCents;
                  return (
                    <tr key={r.name} className="border-t border-line-soft">
                      <td className="py-1.5">{r.name}</td>
                      <td className="tabular py-1.5 text-right text-muted">{formatUsd(r.beforeCents)}</td>
                      <td className="tabular py-1.5 text-right">{formatUsd(r.afterCents)}</td>
                      <td className={cn("tabular py-1.5 pl-3 text-right", d > 0 ? "text-sage" : d < 0 ? "text-flame-deep" : "text-muted")}>
                        {d === 0 ? "no change" : `${d > 0 ? "+" : "−"}${formatUsd(Math.abs(d))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )}
        {status && (
          <div role={status.kind === "error" ? "alert" : "status"} className={cn("mb-3 text-sm", status.kind === "error" ? "text-[#9a3412]" : "text-sage")}>
            {status.text}
            {status.issues && (
              <ul className="mt-1 list-disc pl-5">
                {status.issues.map((i, k) => (
                  <li key={k}>
                    {i.path}: {i.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <Field label="Change summary" className="flex-1">
            <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Raised 105K reference to $27,000" maxLength={200} />
          </Field>
          <Field label="Notes" optional className="flex-1">
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={runPreview} disabled={busy}>
              Preview impact
            </Button>
            <Button variant="ghost" onClick={() => setC(initial)} disabled={!dirty || busy}>
              Discard
            </Button>
            <Button onClick={save} disabled={!dirty || busy}>
              Save new version
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

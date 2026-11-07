"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Field, MoneyInput, NumberInput, Panel, Select, TextInput } from "@/components/ui";
import { CSV_COLUMNS } from "@/lib/comparables-csv";
import type { SaleComparable, VerificationStatus } from "@/lib/engine/calibration";
import { formatUsd } from "@/lib/engine/math";
import type { BalloonCategory, BurnerModelRef, Condition, Fabric, TankCapacity, TankMaterial, ValuationInput, ValuationScope } from "@/lib/engine/types";

interface Form {
  id?: string;
  manufacturer: string;
  model: string;
  volumeCuFt?: number;
  year?: number;
  hours?: number;
  category: BalloonCategory;
  scope: ValuationScope;
  fabric: Fabric;
  condition: Condition | "";
  basket: string;
  basketYear?: number;
  burner: string;
  burnerModelId: string;
  burnerGlow: "glow" | "non_glow" | "unknown";
  burnerYear?: number;
  tanks: string;
  tankMaterial: TankMaterial | "";
  tankCapacity: TankCapacity | "";
  tankQuantity?: number;
  trailer: boolean;
  fan: boolean;
  accessories: string;
  askingPriceCents?: number;
  salePriceCents?: number;
  dateSold: string;
  region: string;
  source: string;
  verification: VerificationStatus;
  notes: string;
}

const EMPTY: Form = {
  manufacturer: "",
  model: "",
  category: "sport",
  scope: "complete_system",
  fabric: "unknown",
  condition: "",
  basket: "",
  burner: "",
  burnerModelId: "",
  burnerGlow: "unknown",
  tanks: "",
  tankMaterial: "",
  tankCapacity: "",
  trailer: false,
  fan: false,
  accessories: "",
  dateSold: "",
  region: "",
  source: "",
  verification: "verified",
  notes: "",
};

const STATUS_LABEL: Record<VerificationStatus, string> = { asking: "Active asking price", reported: "Reported sale", verified: "Verified completed sale" };

function toComparable(f: Form, burners: BurnerModelRef[]): SaleComparable {
  const env = f.scope === "envelope_only" || f.scope === "complete_system";
  let valuationInput: ValuationInput | undefined;
  if (f.manufacturer && (!env || (f.year && f.hours !== undefined && (f.volumeCuFt || f.category === "racer" || f.category === "special_shape")))) {
    const b = burners.find((x) => x.id === f.burnerModelId);
    valuationInput = {
      manufacturer: f.manufacturer,
      model: f.model || undefined,
      volumeCuFt: f.volumeCuFt,
      year: f.year,
      hours: f.hours,
      category: f.category,
      scope: f.scope,
      envelope: env ? { fabric: f.fabric, condition: f.condition || undefined, appearance: "warm", heavyBranding: false } : undefined,
    };
    if (f.scope !== "envelope_only") {
      if (f.basketYear || f.basket) valuationInput.basket = { year: f.basketYear, model: f.basket || undefined };
      if (b || f.burner) valuationInput.burner = { modelId: b?.id, manufacturer: b?.manufacturer, model: b?.model ?? (f.burner || undefined), glow: f.burnerGlow, year: f.burnerYear };
      if (f.tankMaterial && f.tankQuantity) valuationInput.tanks = [{ material: f.tankMaterial, capacity: f.tankCapacity || undefined, quantity: f.tankQuantity }];
      const acc = [...(f.trailer ? [{ key: "trailer" as const }] : []), ...(f.fan ? [{ key: "inflation_fan" as const }] : [])];
      if (acc.length) valuationInput.accessories = acc;
    }
  }
  return {
    id: f.id ?? "",
    manufacturer: f.manufacturer,
    model: f.model || undefined,
    volumeCuFt: f.volumeCuFt,
    year: f.year,
    hours: f.hours,
    fabric: f.fabric,
    condition: f.condition || undefined,
    basket: f.basket || undefined,
    burner: f.burner || (burners.find((x) => x.id === f.burnerModelId) ? `${burners.find((x) => x.id === f.burnerModelId)!.manufacturer} ${burners.find((x) => x.id === f.burnerModelId)!.model}` : undefined),
    tanks: f.tanks || undefined,
    accessories: f.accessories || undefined,
    askingPriceCents: f.askingPriceCents,
    salePriceCents: f.verification === "asking" ? undefined : f.salePriceCents,
    dateSold: f.dateSold || undefined,
    region: f.region || undefined,
    source: f.source || undefined,
    verification: f.verification,
    valuationInput,
    notes: f.notes || undefined,
  };
}

function fromComparable(c: SaleComparable): Form {
  const vi = c.valuationInput;
  return {
    ...EMPTY,
    id: c.id,
    manufacturer: c.manufacturer,
    model: c.model ?? "",
    volumeCuFt: c.volumeCuFt ?? vi?.volumeCuFt,
    year: c.year ?? vi?.year,
    hours: c.hours ?? vi?.hours,
    category: vi?.category ?? "sport",
    scope: vi?.scope ?? "complete_system",
    fabric: (vi?.envelope?.fabric ?? (c.fabric as Fabric)) || "unknown",
    condition: (vi?.envelope?.condition ?? "") as Condition | "",
    basket: c.basket ?? "",
    basketYear: vi?.basket?.year,
    burner: c.burner ?? "",
    burnerModelId: vi?.burner?.modelId ?? "",
    burnerGlow: vi?.burner?.glow ?? "unknown",
    burnerYear: vi?.burner?.year,
    tanks: c.tanks ?? "",
    tankMaterial: vi?.tanks?.[0]?.material ?? "",
    tankCapacity: vi?.tanks?.[0]?.capacity ?? "",
    tankQuantity: vi?.tanks?.[0]?.quantity,
    trailer: Boolean(vi?.accessories?.some((a) => a.key === "trailer")),
    fan: Boolean(vi?.accessories?.some((a) => a.key === "inflation_fan")),
    accessories: c.accessories ?? "",
    askingPriceCents: c.askingPriceCents,
    salePriceCents: c.salePriceCents,
    dateSold: c.dateSold ?? "",
    region: c.region ?? "",
    source: c.source ?? "",
    verification: c.verification,
    notes: c.notes ?? "",
  };
}

export function ComparablesManager({ initial, burners }: { initial: SaleComparable[]; burners: BurnerModelRef[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form) return;
    setBusy(true);
    const res = await fetch("/api/admin/comparables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toComparable(form, burners)) });
    setBusy(false);
    const body = await res.json();
    if (res.ok) {
      setForm(null);
      setMsg({ kind: "ok", text: "Comparable saved." });
      router.refresh();
    } else setMsg({ kind: "error", text: body.issues?.[0] ? `${body.error} ${body.issues[0].path}: ${body.issues[0].message}` : body.error });
  }

  async function remove(c: SaleComparable) {
    if (!confirm(`Delete this ${c.manufacturer} record?`)) return;
    await fetch(`/api/admin/comparables/${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function importCsv(file: File) {
    setBusy(true);
    const res = await fetch("/api/admin/comparables/import", { method: "POST", headers: { "Content-Type": "text/csv" }, body: await file.text() });
    setBusy(false);
    const body = await res.json();
    if (res.ok) {
      setMsg({
        kind: body.errors.length ? "error" : "ok",
        text: `Imported ${body.imported} records.${body.errors.length ? ` Skipped ${body.errors.length}: ${body.errors.slice(0, 5).map((e: { line: number; message: string }) => `line ${e.line} ${e.message}`).join("; ")}` : ""}`,
      });
      router.refresh();
    } else setMsg({ kind: "error", text: body.error });
  }

  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_COLUMNS.join(",") + "\n")}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Comparable sales</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Record real transactions. Asking prices, reported sales and verified completed sales are kept apart; only verified completed sales feed accuracy statistics and confidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setForm({ ...EMPTY })}>Add record</Button>
          <label className="inline-flex cursor-pointer items-center rounded-[var(--radius-control)] border border-line bg-paper px-4 py-2.5 text-[0.95rem] font-medium hover:border-navy-500">
            Import CSV
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} disabled={busy} />
          </label>
          <a href="/api/admin/comparables/export" className="inline-flex items-center rounded-[var(--radius-control)] px-4 py-2.5 text-[0.95rem] font-medium hover:bg-ivory-deep">
            Export CSV
          </a>
          <a href={template} download="comparables-template.csv" className="inline-flex items-center rounded-[var(--radius-control)] px-4 py-2.5 text-[0.95rem] text-muted hover:bg-ivory-deep">
            Template
          </a>
        </div>
      </div>

      {msg && (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`mt-4 text-sm ${msg.kind === "error" ? "text-[#9a3412]" : "text-sage"}`}>
          {msg.text}
        </p>
      )}

      {form && (
        <Panel className="mt-6 p-5 sm:p-6">
          <h2 className="font-sans text-base font-semibold">{form.id ? "Edit record" : "New record"}</h2>
          <p className="mt-1 text-sm text-muted">Fill in the equipment fields to let the model predict this sale. Without them the record is stored but not used for calibration.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Verification">
              <Select value={form.verification} onChange={(e) => set("verification", e.target.value as VerificationStatus)}>
                {(Object.keys(STATUS_LABEL) as VerificationStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Manufacturer">
              <TextInput value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
            </Field>
            <Field label="Model" optional>
              <TextInput value={form.model} onChange={(e) => set("model", e.target.value)} />
            </Field>
            <Field label="What sold">
              <Select value={form.scope} onChange={(e) => set("scope", e.target.value as ValuationScope)}>
                <option value="complete_system">Complete system</option>
                <option value="envelope_only">Envelope only</option>
                <option value="basket_burner">Basket and burner</option>
                <option value="components">Components</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => set("category", e.target.value as BalloonCategory)}>
                <option value="sport">Sport</option>
                <option value="commercial">Commercial</option>
                <option value="racer">Racer</option>
                <option value="special_shape">Special shape</option>
              </Select>
            </Field>
            <Field label="Volume">
              <NumberInput value={form.volumeCuFt} onValue={(v) => set("volumeCuFt", v)} suffix="cu ft" />
            </Field>
            <Field label="Envelope year">
              <NumberInput value={form.year} onValue={(v) => set("year", v)} />
            </Field>
            <Field label="Envelope hours">
              <NumberInput decimals value={form.hours} onValue={(v) => set("hours", v)} suffix="h" />
            </Field>
            <Field label="Fabric">
              <Select value={form.fabric} onChange={(e) => set("fabric", e.target.value as Fabric)}>
                <option value="polyester">Polyester</option>
                <option value="nylon">Nylon</option>
                <option value="hyperlast">Hyperlast</option>
                <option value="mixed">Mixed</option>
                <option value="unknown">Unknown</option>
              </Select>
            </Field>
            <Field label="Envelope condition">
              <Select value={form.condition} onChange={(e) => set("condition", e.target.value as Condition | "")}>
                <option value="">Unknown</option>
                {["A", "B", "C", "D", "E"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
            <Field label="Basket" optional>
              <TextInput value={form.basket} onChange={(e) => set("basket", e.target.value)} />
            </Field>
            <Field label="Basket year" optional>
              <NumberInput value={form.basketYear} onValue={(v) => set("basketYear", v)} />
            </Field>
            <Field label="Burner (reference list)" optional>
              <Select value={form.burnerModelId} onChange={(e) => set("burnerModelId", e.target.value)}>
                <option value="">Not listed</option>
                {burners.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.manufacturer} {b.model}
                    {b.glow === "glow" ? " (Glow)" : b.glow === "non_glow" ? " (non-Glow)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Burner description" optional>
              <TextInput value={form.burner} onChange={(e) => set("burner", e.target.value)} />
            </Field>
            <Field label="Burner glow">
              <Select value={form.burnerGlow} onChange={(e) => set("burnerGlow", e.target.value as Form["burnerGlow"])}>
                <option value="unknown">Unknown</option>
                <option value="non_glow">Non-Glow</option>
                <option value="glow">Glow</option>
              </Select>
            </Field>
            <Field label="Burner year" optional>
              <NumberInput value={form.burnerYear} onValue={(v) => set("burnerYear", v)} />
            </Field>
            <Field label="Tank material">
              <Select value={form.tankMaterial} onChange={(e) => set("tankMaterial", e.target.value as TankMaterial | "")}>
                <option value="">None</option>
                <option value="aluminum">Aluminum</option>
                <option value="steel">Steel</option>
                <option value="unknown">Unknown</option>
              </Select>
            </Field>
            <Field label="Tank capacity">
              <Select value={form.tankCapacity} onChange={(e) => set("tankCapacity", e.target.value as TankCapacity | "")}>
                <option value="">Unknown</option>
                <option value="10">10 gal</option>
                <option value="15">15 gal</option>
                <option value="20">20 gal</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Tank quantity">
              <NumberInput value={form.tankQuantity} onValue={(v) => set("tankQuantity", v)} />
            </Field>
            <div className="flex items-end gap-5 pb-3 text-[0.95rem]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.trailer} onChange={(e) => set("trailer", e.target.checked)} /> Trailer
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.fan} onChange={(e) => set("fan", e.target.checked)} /> Inflation fan
              </label>
            </div>
            <Field label="Original asking price" optional>
              <MoneyInput cents={form.askingPriceCents} onCents={(v) => set("askingPriceCents", v)} />
            </Field>
            {form.verification !== "asking" && (
              <Field label="Final selling price">
                <MoneyInput cents={form.salePriceCents} onCents={(v) => set("salePriceCents", v)} />
              </Field>
            )}
            <Field label="Date sold" optional={form.verification !== "verified"}>
              <TextInput type="date" value={form.dateSold} onChange={(e) => set("dateSold", e.target.value)} />
            </Field>
            <Field label="Region" optional>
              <TextInput value={form.region} onChange={(e) => set("region", e.target.value)} />
            </Field>
            <Field label="Data source" optional>
              <TextInput value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="e.g. Buyer, bill of sale" />
            </Field>
            <Field label="Notes" optional className="sm:col-span-2 lg:col-span-3">
              <TextInput value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={save} disabled={busy || !form.manufacturer}>
              Save record
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <Panel className="mt-6 overflow-x-auto">
        {initial.length === 0 ? (
          <p className="p-8 text-center text-muted">No comparable sales yet. Add verified completed sales as they come in, or import a CSV.</p>
        ) : (
          <table className="w-full min-w-[820px] text-[0.93rem]">
            <thead>
              <tr className="border-b border-line text-left text-sm text-muted">
                <th className="px-4 py-3 font-normal">Balloon</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 text-right font-normal">Asking</th>
                <th className="px-4 py-3 text-right font-normal">Sold for</th>
                <th className="px-4 py-3 font-normal">Date</th>
                <th className="px-4 py-3 font-normal">Region</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {initial.map((c) => (
                <tr key={c.id} className="border-b border-line-soft">
                  <td className="px-4 py-3">
                    {[c.year, c.manufacturer, c.model].filter(Boolean).join(" ")}
                    {!c.valuationInput && <span className="block text-xs text-muted">No equipment details for prediction</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={c.verification === "verified" ? "sage" : c.verification === "reported" ? "gold" : "neutral"}>{STATUS_LABEL[c.verification]}</Badge>
                  </td>
                  <td className="tabular px-4 py-3 text-right">{c.askingPriceCents !== undefined ? formatUsd(c.askingPriceCents) : ""}</td>
                  <td className="tabular px-4 py-3 text-right">{c.salePriceCents !== undefined ? formatUsd(c.salePriceCents) : ""}</td>
                  <td className="tabular px-4 py-3">{c.dateSold}</td>
                  <td className="px-4 py-3">{c.region}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setForm(fromComparable(c))}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

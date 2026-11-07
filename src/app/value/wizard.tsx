"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, CheckTile, ChoiceGroup, Field, MoneyInput, NumberInput, Panel, Select, TextInput } from "@/components/ui";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { modelsFor, MORE_MANUFACTURERS, PRIMARY_MANUFACTURERS } from "@/lib/catalog";
import { clearDraft, getLocalValuation, loadDraft, saveDraft, saveLocalValuation, titleFor } from "@/lib/client/storage";
import { COMMON_VOLUMES } from "@/lib/engine/defaults";
import { formatUsd } from "@/lib/engine/math";
import type {
  AccessoryKey,
  AccessoryRef,
  BalloonCategory,
  BasketInput,
  BasketModelRef,
  BurnerInput,
  BurnerModelRef,
  Condition,
  EnvelopeFeatureKey,
  EnvelopeInput,
  FabricShare,
  FeatureRef,
  TankInput,
  ValuationInput,
  ValuationScope,
} from "@/lib/engine/types";
import { cn } from "@/lib/cn";

interface Reference {
  configVersion: number;
  burnerModels: BurnerModelRef[];
  basketModels: BasketModelRef[];
  accessories: AccessoryRef[];
  features: FeatureRef[];
  tankPrices: { aluminumCents: number; steel: Record<"10" | "15" | "20", number> };
}

type ConditionChoice = Condition | "unknown";

interface Draft {
  scope: ValuationScope;
  manufacturer: string;
  model: string;
  volumeCuFt?: number;
  year?: number;
  hours?: number;
  category: BalloonCategory;
  envelope: Omit<EnvelopeInput, "condition"> & { condition: ConditionChoice | undefined };
  includeBasket: boolean;
  basket: Omit<BasketInput, "condition"> & { condition?: ConditionChoice };
  includeBurner: boolean;
  burner: Omit<BurnerInput, "condition"> & { condition?: ConditionChoice };
  tanks: TankInput[];
  accessories: Partial<Record<AccessoryKey, { selected: boolean; valueCents?: number; label?: string }>>;
  askingPriceCents?: number;
}

const EMPTY: Draft = {
  scope: "complete_system",
  manufacturer: "",
  model: "",
  category: "sport",
  envelope: { fabric: "polyester", condition: undefined, appearance: "warm", heavyBranding: false, features: [] },
  includeBasket: true,
  basket: {},
  includeBurner: true,
  burner: { glow: "unknown" },
  tanks: [],
  accessories: {},
};

type StepKey = "balloon" | "envelope" | "basket" | "burner" | "tanks" | "accessories" | "asking";

const STEP_LABEL: Record<StepKey, string> = {
  balloon: "Balloon",
  envelope: "Envelope",
  basket: "Basket",
  burner: "Burner",
  tanks: "Fuel tanks",
  accessories: "Accessories",
  asking: "Asking price",
};

function stepsFor(scope: ValuationScope): StepKey[] {
  if (scope === "envelope_only") return ["balloon", "envelope", "asking"];
  if (scope === "complete_system") return ["balloon", "envelope", "basket", "burner", "tanks", "accessories", "asking"];
  return ["balloon", "basket", "burner", "tanks", "accessories", "asking"];
}

const withEnvelope = (s: ValuationScope) => s === "envelope_only" || s === "complete_system";
const cond = (c?: ConditionChoice): Condition | undefined => (c && c !== "unknown" ? c : undefined);
const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);

export function toInput(d: Draft): ValuationInput {
  const env = withEnvelope(d.scope);
  const input: ValuationInput = {
    manufacturer: d.manufacturer,
    model: clean(d.model),
    category: d.category,
    scope: d.scope,
    askingPriceCents: d.askingPriceCents,
  };
  if (env) {
    input.volumeCuFt = d.volumeCuFt;
    input.year = d.year;
    input.hours = d.hours;
    const e = d.envelope;
    input.envelope = {
      fabric: e.fabric,
      fabricMix: e.fabric === "mixed" ? (e.fabricMix ?? []).filter((s) => s.percent > 0) : undefined,
      condition: cond(e.condition),
      appearance: e.appearance,
      heavyBranding: e.heavyBranding,
      features: e.features?.length ? e.features : undefined,
      otherFeatureNote: clean(e.otherFeatureNote),
      knownReplacementCostCents: e.knownReplacementCostCents,
      inspection:
        e.inspection && Object.values(e.inspection).some((v) => v && String(v).trim())
          ? {
              lastAnnualDate: clean(e.inspection.lastAnnualDate),
              porosityNote: clean(e.inspection.porosityNote),
              fabricStrengthNote: clean(e.inspection.fabricStrengthNote),
              majorRepairs: clean(e.inspection.majorRepairs),
            }
          : undefined,
    };
  } else {
    input.year = d.year;
  }
  const hardware = d.scope !== "envelope_only";
  if (hardware && d.includeBasket) {
    const b = d.basket;
    input.basket = {
      manufacturer: clean(b.manufacturer),
      model: clean(b.model),
      modelId: b.modelId,
      year: b.year,
      dimensions: clean(b.dimensions),
      condition: cond(b.condition),
      construction: b.construction,
      customNote: clean(b.customNote),
      knownResaleCents: b.knownResaleCents,
    };
  }
  if (hardware && d.includeBurner) {
    const b = d.burner;
    input.burner = {
      manufacturer: clean(b.manufacturer),
      model: clean(b.model),
      modelId: b.modelId,
      configuration: b.configuration,
      glow: b.glow,
      year: b.year,
      condition: cond(b.condition),
      knownResaleCents: b.knownResaleCents,
    };
  }
  if (hardware) {
    input.tanks = d.tanks.filter((t) => t.quantity > 0).map((t) => ({ ...t, manufacturer: clean(t.manufacturer) }));
    input.accessories = (Object.entries(d.accessories) as [AccessoryKey, { selected: boolean; valueCents?: number; label?: string }][])
      .filter(([, a]) => a.selected)
      .map(([key, a]) => ({ key, valueCents: a.valueCents, label: clean(a.label) }));
  }
  return input;
}

function fromInput(i: ValuationInput): Draft {
  const c = (x?: Condition): ConditionChoice | undefined => x ?? "unknown";
  return {
    ...EMPTY,
    scope: i.scope,
    manufacturer: i.manufacturer,
    model: i.model ?? "",
    volumeCuFt: i.volumeCuFt,
    year: i.year,
    hours: i.hours,
    category: i.category,
    envelope: i.envelope ? { ...EMPTY.envelope, ...i.envelope, condition: c(i.envelope.condition) } : EMPTY.envelope,
    includeBasket: Boolean(i.basket) || i.scope === "envelope_only",
    basket: i.basket ? { ...i.basket, condition: c(i.basket.condition) } : {},
    includeBurner: Boolean(i.burner) || i.scope === "envelope_only",
    burner: i.burner ? { ...i.burner, condition: c(i.burner.condition) } : { glow: "unknown" },
    tanks: i.tanks ?? [],
    accessories: Object.fromEntries((i.accessories ?? []).map((a) => [a.key, { selected: true, valueCents: a.valueCents, label: a.label }])),
    askingPriceCents: i.askingPriceCents,
  };
}

const CONDITION_CHOICES: { value: ConditionChoice; label: string; description: string }[] = [
  { value: "A", label: "A: Excellent", description: "Bright, strong fabric with minimal wear. No significant repairs. History well documented." },
  { value: "B", label: "B: Good", description: "Light, normal wear for its age. Minor repairs only. Nothing a buyer must fix soon." },
  { value: "C", label: "C: Average", description: "Typical wear, some fading or repairs. Serviceable with ordinary upkeep." },
  { value: "D", label: "D: Fair", description: "Noticeable wear, fading, or porosity concerns. Repairs may be needed soon." },
  { value: "E", label: "E: Poor", description: "Heavy wear, major repairs needed, or fabric condition in doubt." },
  { value: "unknown", label: "Not sure", description: "Average (C) is used provisionally and noted on the report." },
];

const HW_CONDITION_CHOICES = CONDITION_CHOICES.map((c) => ({ ...c, description: c.value === "unknown" ? c.description : undefined }));

const TANK_MAKERS = ["Worthington", "Prince", "Cameron", "Other"];

export function Wizard({ editId }: { editId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [ref, setRef] = useState<Reference | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fetch("/api/reference")
      .then((r) => r.json())
      .then(setRef)
      .catch(() => setRef(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (editId) {
        const local = getLocalValuation(editId);
        const res = await fetch(`/api/valuations/${editId}`, { headers: local ? { "x-edit-token": local.editToken } : {} });
        if (res.ok && !cancelled) {
          const { valuation } = await res.json();
          setDraft(fromInput(valuation.input));
        }
      } else {
        const saved = loadDraft<{ draft: Draft; stepIndex: number }>();
        if (saved?.draft && !cancelled) {
          setDraft({ ...EMPTY, ...saved.draft });
          setStepIndex(Math.min(saved.stepIndex ?? 0, stepsFor(saved.draft.scope).length - 1));
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  useEffect(() => {
    if (hydrated && !editId) saveDraft({ draft, stepIndex });
  }, [draft, stepIndex, hydrated, editId]);

  const steps = stepsFor(draft.scope);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setEnv = (patch: Partial<Draft["envelope"]>) => setDraft((d) => ({ ...d, envelope: { ...d.envelope, ...patch } }));
  const setBasket = (patch: Partial<Draft["basket"]>) => setDraft((d) => ({ ...d, basket: { ...d.basket, ...patch } }));
  const setBurner = (patch: Partial<Draft["burner"]>) => setDraft((d) => ({ ...d, burner: { ...d.burner, ...patch } }));

  function validate(s: StepKey): Record<string, string> {
    const e: Record<string, string> = {};
    const nowYear = new Date().getFullYear();
    if (s === "balloon") {
      if (!draft.manufacturer) e.manufacturer = "Choose a manufacturer, or Other.";
      if (withEnvelope(draft.scope)) {
        if (!draft.year) e.year = "Enter the envelope year of manufacture.";
        else if (draft.year < 1950 || draft.year > nowYear) e.year = `Enter a year between 1950 and ${nowYear}.`;
        if (draft.hours === undefined) e.hours = "Enter total envelope hours. Use your best estimate from the logbook.";
        else if (draft.hours < 0) e.hours = "Hours cannot be negative.";
        if ((draft.category === "sport" || draft.category === "commercial") && !draft.volumeCuFt) {
          e.volumeCuFt = "Enter the envelope volume in cubic feet.";
        }
      }
    }
    if (s === "envelope" && draft.envelope.fabric === "mixed") {
      const total = (draft.envelope.fabricMix ?? []).reduce((n, x) => n + (x.percent || 0), 0);
      if (total > 100) e.fabricMix = "Fabric percentages add up to more than 100%.";
    }
    if (s === "basket" && draft.includeBasket && draft.basket.year && (draft.basket.year < 1950 || draft.basket.year > nowYear)) {
      e.basketYear = `Enter a year between 1950 and ${nowYear}.`;
    }
    if (s === "burner" && draft.includeBurner && draft.burner.year && (draft.burner.year < 1950 || draft.burner.year > nowYear)) {
      e.burnerYear = `Enter a year between 1950 and ${nowYear}.`;
    }
    return e;
  }

  function go(to: number) {
    setStepIndex(to);
    setErrors({});
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (isLast) void submit();
    else go(stepIndex + 1);
  }

  async function submit() {
    setSubmitting(true);
    setServerError(null);
    try {
      const input = toInput(draft);
      const local = editId ? getLocalValuation(editId) : undefined;
      const res = await fetch(editId ? `/api/valuations/${editId}` : "/api/valuations", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...(local ? { "x-edit-token": local.editToken } : {}) },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) {
        const issue = body.issues?.[0];
        setServerError(issue ? `${issue.message}${issue.path ? ` (${issue.path})` : ""}` : body.error ?? "The valuation could not be calculated.");
        return;
      }
      const v = body.valuation;
      saveLocalValuation({
        id: v.id,
        editToken: body.editToken ?? local?.editToken ?? "",
        referenceNumber: v.referenceNumber,
        title: titleFor(v.input),
        fairMarketValueCents: v.result.fairMarketValueCents,
        createdAt: v.createdAt,
      });
      if (!editId) clearDraft();
      router.push(`/valuation/${v.id}`);
    } catch {
      setServerError("The valuation service could not be reached. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const manufacturerModels = useMemo(() => modelsFor(draft.manufacturer), [draft.manufacturer]);
  const modelOptions: ComboOption[] = useMemo(
    () =>
      manufacturerModels.map((m) => ({
        value: m.model,
        label: m.model,
        hint: m.volumeCuFt ? `${Math.round(m.volumeCuFt / 1000)}K cu ft` : undefined,
      })),
    [manufacturerModels],
  );

  const burnerOptions = ref?.burnerModels ?? [];
  const basketOptions = ref?.basketModels ?? [];

  if (!hydrated) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-muted sm:px-6">Loading the valuation form…</div>;
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:py-14">
      {/* Progress rail */}
      <nav aria-label="Valuation steps" className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-sm text-muted">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible">
          {steps.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  disabled={i > stepIndex}
                  onClick={() => go(i)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[0.93rem] lg:border-l-2 lg:rounded-none lg:pl-4",
                    current ? "bg-paper font-medium text-ink lg:border-flame lg:bg-transparent" : done ? "text-ink hover:text-flame-deep lg:border-navy-900" : "text-muted lg:border-line",
                  )}
                >
                  <span
                    className={cn(
                      "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs",
                      current ? "bg-flame text-white" : done ? "bg-navy-900 text-ivory" : "border border-line text-muted",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="whitespace-nowrap">{STEP_LABEL[s]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form
        className="min-w-0"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <h1 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-3xl outline-none sm:text-[2.4rem]">
          {
            {
              balloon: editId ? "Edit your balloon" : "Tell us about the balloon",
              envelope: "Envelope details",
              basket: "Basket",
              burner: "Burner",
              tanks: "Fuel tanks",
              accessories: "Accessories",
              asking: "Asking price",
            }[step]
          }
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {
            {
              balloon: "Start with what you are valuing. Choosing a model fills in its usual size, which you can change.",
              envelope: "Fabric, condition and appearance adjust the envelope value. Only the envelope is affected by appearance.",
              basket: "Baskets are valued on their own age and condition, separate from the envelope.",
              burner: "Pick the burner from the list if it is there. Listed burners use used-market reference prices.",
              tanks: "Add each group of tanks. Material decides the value, so identify aluminum or steel if you can.",
              accessories: "Only equipment you select here is added to the value.",
              asking: "If you are looking at a listing, enter the seller's price to see how it compares.",
            }[step]
          }
        </p>

        <Panel className="mt-8 p-5 sm:p-8">
          <div className="flex flex-col gap-7">
            {step === "balloon" && (
              <>
                <ChoiceGroup
                  name="scope"
                  legend="What are you valuing?"
                  value={draft.scope}
                  columns={2}
                  onChange={(v) => {
                    set("scope", v);
                    setStepIndex(0);
                  }}
                  choices={[
                    { value: "complete_system", label: "Complete balloon system", description: "Envelope plus the basket, burner, tanks and accessories you include" },
                    { value: "envelope_only", label: "Envelope only", description: "The fabric envelope by itself" },
                    { value: "basket_burner", label: "Basket and burner system", description: "Hardware without an envelope" },
                    { value: "components", label: "Individual equipment", description: "Any mix of basket, burner, tanks or accessories" },
                  ]}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Manufacturer" htmlFor="manufacturer" error={errors.manufacturer} hint={withEnvelope(draft.scope) ? "Envelope manufacturer" : "Main equipment manufacturer"}>
                    <Select
                      id="manufacturer"
                      value={draft.manufacturer}
                      aria-invalid={Boolean(errors.manufacturer) || undefined}
                      onChange={(e) => setDraft((d) => ({ ...d, manufacturer: e.target.value, model: "" }))}
                    >
                      <option value="">Choose…</option>
                      <optgroup label="Common manufacturers">
                        {PRIMARY_MANUFACTURERS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                        <option>Other</option>
                      </optgroup>
                      <optgroup label="More manufacturers">
                        {MORE_MANUFACTURERS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </optgroup>
                    </Select>
                  </Field>
                  <Field
                    label="Model"
                    htmlFor="model"
                    optional
                    hint={manufacturerModels.length ? `${manufacturerModels.length} known models. Type any model not listed.` : "Type the model as shown on the data plate."}
                  >
                    <Combobox
                      id="model"
                      value={draft.model}
                      onChange={(v) => set("model", v)}
                      options={modelOptions}
                      placeholder={manufacturerModels[0] ? `e.g. ${manufacturerModels[0].model}` : "e.g. O-90"}
                      onPick={(o) => {
                        const m = manufacturerModels.find((x) => x.model === o.value);
                        if (!m) return;
                        setDraft((d) => ({
                          ...d,
                          model: m.model,
                          volumeCuFt: m.volumeCuFt ?? d.volumeCuFt,
                          category: m.category,
                        }));
                      }}
                    />
                  </Field>
                </div>

                {withEnvelope(draft.scope) && (
                  <>
                    <ChoiceGroup
                      name="category"
                      legend="Balloon category"
                      value={draft.category}
                      onChange={(v) => set("category", v)}
                      columns={4}
                      choices={[
                        { value: "sport", label: "Sport" },
                        { value: "commercial", label: "Commercial" },
                        { value: "racer", label: "Racer" },
                        { value: "special_shape", label: "Special shape" },
                      ]}
                    />
                    <div className="grid gap-5 sm:grid-cols-3">
                      <Field
                        label="Envelope volume"
                        htmlFor="volume"
                        error={errors.volumeCuFt}
                        optional={draft.category === "racer" || draft.category === "special_shape"}
                        hint="Actual cubic feet"
                      >
                        <NumberInput id="volume" value={draft.volumeCuFt} onValue={(v) => set("volumeCuFt", v)} suffix="cu ft" invalid={Boolean(errors.volumeCuFt)} />
                      </Field>
                      <Field label="Year manufactured" htmlFor="year" error={errors.year}>
                        <NumberInput id="year" value={draft.year} onValue={(v) => set("year", v)} placeholder="e.g. 2012" maxLength={4} invalid={Boolean(errors.year)} />
                      </Field>
                      <Field label="Total envelope hours" htmlFor="hours" error={errors.hours}>
                        <NumberInput id="hours" decimals value={draft.hours} onValue={(v) => set("hours", v)} suffix="hours" invalid={Boolean(errors.hours)} />
                      </Field>
                    </div>
                    <div className="-mt-3 flex flex-wrap gap-1.5" aria-label="Common volumes">
                      {COMMON_VOLUMES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => set("volumeCuFt", v)}
                          className={cn(
                            "tabular rounded-full border px-2.5 py-1 text-xs",
                            draft.volumeCuFt === v ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-paper text-muted hover:border-navy-500 hover:text-ink",
                          )}
                        >
                          {v / 1000}K
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {step === "envelope" && (
              <>
                <ChoiceGroup
                  name="fabric"
                  legend="Fabric type"
                  value={draft.envelope.fabric}
                  onChange={(v) => setEnv({ fabric: v, fabricMix: v === "mixed" ? draft.envelope.fabricMix?.length ? draft.envelope.fabricMix : [{ fabric: "hyperlast", percent: 0 }, { fabric: "nylon", percent: 0 }] : undefined })}
                  columns={5}
                  choices={[
                    { value: "polyester", label: "Polyester" },
                    { value: "nylon", label: "Nylon" },
                    { value: "hyperlast", label: "Hyperlast" },
                    { value: "mixed", label: "Mixed" },
                    { value: "unknown", label: "Not sure" },
                  ]}
                />
                {draft.envelope.fabric === "mixed" && (
                  <FabricMixEditor mix={draft.envelope.fabricMix ?? []} onChange={(fabricMix) => setEnv({ fabricMix })} error={errors.fabricMix} />
                )}

                <ChoiceGroup
                  name="envCondition"
                  legend="Envelope condition"
                  hint="A recent annual inspection on its own does not make an envelope Excellent."
                  value={draft.envelope.condition}
                  onChange={(v) => setEnv({ condition: v })}
                  columns={3}
                  choices={CONDITION_CHOICES}
                />

                <ChoiceGroup
                  name="appearance"
                  legend="Appearance"
                  hint="Buyers pay less for color schemes that are hard to resell. This only affects the envelope."
                  value={draft.envelope.appearance}
                  onChange={(v) => setEnv({ appearance: v })}
                  columns={3}
                  choices={[
                    { value: "warm", label: "Attractive warm colors" },
                    { value: "neutral", label: "Neutral design" },
                    { value: "unattractive", label: "Unattractive or mostly non-warm colors" },
                  ]}
                />

                <ChoiceGroup
                  name="branding"
                  legend="Heavy commercial branding"
                  value={draft.envelope.heavyBranding ? "yes" : "no"}
                  onChange={(v) => setEnv({ heavyBranding: v === "yes" })}
                  columns={2}
                  choices={[
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes", description: "Logos or sponsor artwork a new owner would likely need to cover or replace" },
                  ]}
                />

                <fieldset>
                  <legend className="mb-1.5 text-[0.93rem] font-medium">Additional envelope features</legend>
                  <p className="mb-3 text-[0.84rem] text-muted">Recorded on the report. They change the value only where a price has been set.</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(ref?.features ?? []).map((f) => {
                      const on = draft.envelope.features?.includes(f.key) ?? false;
                      return (
                        <CheckTile
                          key={f.key}
                          checked={on}
                          label={f.label}
                          onChange={(v) =>
                            setEnv({
                              features: v
                                ? [...(draft.envelope.features ?? []), f.key]
                                : (draft.envelope.features ?? []).filter((k: EnvelopeFeatureKey) => k !== f.key),
                            })
                          }
                        />
                      );
                    })}
                  </div>
                  {draft.envelope.features?.includes("other") && (
                    <TextInput
                      className="mt-3"
                      placeholder="Describe the other feature"
                      aria-label="Other feature"
                      value={draft.envelope.otherFeatureNote ?? ""}
                      onChange={(e) => setEnv({ otherFeatureNote: e.target.value })}
                    />
                  )}
                </fieldset>

                <Field
                  label="Do you know what a brand-new equivalent envelope costs today?"
                  htmlFor="replacement"
                  optional
                  hint="A current quote replaces the generic size-based reference and improves accuracy, especially for racers, special shapes and large balloons."
                >
                  <div className="max-w-xs">
                    <MoneyInput id="replacement" cents={draft.envelope.knownReplacementCostCents} onCents={(c) => setEnv({ knownReplacementCostCents: c })} placeholder="New envelope price" />
                  </div>
                </Field>

                <details className="group rounded-[var(--radius-control)] border border-line-soft bg-ivory/50 px-4 py-3">
                  <summary className="cursor-pointer list-none text-[0.95rem] font-medium marker:hidden">
                    <span className="inline-flex items-center gap-2">
                      <svg width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open:rotate-90" aria-hidden="true">
                        <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      Inspection information
                    </span>
                    <span className="ml-2 font-normal text-muted">optional</span>
                  </summary>
                  <p className="mt-2 text-[0.84rem] text-muted">These notes help identify uncertainty. They do not establish airworthiness.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Last annual inspection" htmlFor="annual">
                      <TextInput id="annual" type="date" value={draft.envelope.inspection?.lastAnnualDate ?? ""} onChange={(e) => setEnv({ inspection: { ...draft.envelope.inspection, lastAnnualDate: e.target.value } })} />
                    </Field>
                    <Field label="Porosity test results" htmlFor="porosity">
                      <TextInput id="porosity" placeholder="e.g. 30+ seconds at the crown" value={draft.envelope.inspection?.porosityNote ?? ""} onChange={(e) => setEnv({ inspection: { ...draft.envelope.inspection, porosityNote: e.target.value } })} />
                    </Field>
                    <Field label="Fabric strength test results" htmlFor="grab">
                      <TextInput id="grab" placeholder="e.g. Grab test passed" value={draft.envelope.inspection?.fabricStrengthNote ?? ""} onChange={(e) => setEnv({ inspection: { ...draft.envelope.inspection, fabricStrengthNote: e.target.value } })} />
                    </Field>
                    <Field label="Major repairs" htmlFor="repairs">
                      <TextInput id="repairs" placeholder="e.g. Two panels replaced 2021" value={draft.envelope.inspection?.majorRepairs ?? ""} onChange={(e) => setEnv({ inspection: { ...draft.envelope.inspection, majorRepairs: e.target.value } })} />
                    </Field>
                  </div>
                </details>
              </>
            )}

            {step === "basket" && (
              <>
                <IncludeToggle
                  name="incBasket"
                  label={draft.scope === "complete_system" ? "Is a basket included?" : "Include a basket?"}
                  value={draft.includeBasket}
                  onChange={(v) => set("includeBasket", v)}
                />
                {draft.includeBasket && (
                  <>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Basket manufacturer" htmlFor="bMfr" optional>
                            <Combobox
                              id="bMfr"
                              value={draft.basket.manufacturer ?? ""}
                              onChange={(v) => setBasket({ manufacturer: v, modelId: undefined })}
                              options={[...new Set(basketOptions.map((b) => b.manufacturer))].map((m) => ({ value: m, label: m }))}
                              placeholder="e.g. Cameron"
                            />
                          </Field>
                          <Field label="Basket model" htmlFor="bModel" optional>
                            <Combobox
                              id="bModel"
                              value={draft.basket.model ?? ""}
                              onChange={(v) => setBasket({ model: v, modelId: undefined })}
                              options={basketOptions
                                .filter((b) => !draft.basket.manufacturer || b.manufacturer.toLowerCase() === draft.basket.manufacturer.toLowerCase())
                                .map((b) => ({ value: b.id, label: b.model, hint: b.manufacturer }))}
                              onPick={(o) => {
                                const b = basketOptions.find((x) => x.id === o.value);
                                if (b) setBasket({ modelId: b.id, model: b.model, manufacturer: b.manufacturer, construction: b.construction ?? draft.basket.construction });
                              }}
                              placeholder="e.g. 42 × 52"
                            />
                          </Field>
                          <Field label="Year manufactured" htmlFor="bYear" error={errors.basketYear} hint="If unknown, the envelope year is used and the report says so.">
                            <NumberInput id="bYear" value={draft.basket.year} onValue={(v) => setBasket({ year: v })} placeholder="e.g. 2012" invalid={Boolean(errors.basketYear)} />
                          </Field>
                          <Field label="Dimensions" htmlFor="bDim" optional>
                            <TextInput id="bDim" placeholder="e.g. 42 × 52 in" value={draft.basket.dimensions ?? ""} onChange={(e) => setBasket({ dimensions: e.target.value })} />
                          </Field>
                        </div>
                        <ChoiceGroup
                          name="bConstruction"
                          legend="Construction"
                          value={draft.basket.construction}
                          onChange={(v) => setBasket({ construction: v })}
                          columns={2}
                          choices={[
                            { value: "standard", label: "Standard" },
                            { value: "lightweight", label: "Lightweight" },
                          ]}
                        />
                        <ChoiceGroup name="bCondition" legend="Basket condition" value={draft.basket.condition} onChange={(v) => setBasket({ condition: v })} columns={3} choices={HW_CONDITION_CHOICES} />
                        <div className="grid gap-5 sm:grid-cols-2">
                          <Field label="Known resale value" htmlFor="bKnown" optional hint="If you know what this basket sells for used, it is used as is.">
                            <MoneyInput id="bKnown" cents={draft.basket.knownResaleCents} onCents={(c) => setBasket({ knownResaleCents: c })} />
                          </Field>
                          <Field label="Custom details" htmlFor="bNote" optional hint="Leather, cane, skids and finishes are recorded, not priced automatically.">
                            <TextInput id="bNote" value={draft.basket.customNote ?? ""} onChange={(e) => setBasket({ customNote: e.target.value })} />
                          </Field>
                        </div>
                  </>
                )}
              </>
            )}

            {step === "burner" && (
              <>
                <IncludeToggle
                  name="incBurner"
                  label={draft.scope === "complete_system" ? "Is a burner included?" : "Include a burner?"}
                  value={draft.includeBurner}
                  onChange={(v) => set("includeBurner", v)}
                />
                {draft.includeBurner && (
                  <>
                    <Field label="Burner" htmlFor="burnerPick" hint="Choose from the reference list, or pick Other to type it in.">
                      <Select
                        id="burnerPick"
                        value={draft.burner.modelId ?? (draft.burner.manufacturer || draft.burner.model ? "__other" : "")}
                        onChange={(e) => {
                          const id = e.target.value;
                          const b = burnerOptions.find((x) => x.id === id);
                          if (b) {
                            setBurner({
                              modelId: b.id,
                              manufacturer: b.manufacturer,
                              model: b.model,
                              configuration: b.configuration ?? draft.burner.configuration,
                              glow: b.glow === "any" ? draft.burner.glow : b.glow,
                            });
                          } else {
                            setBurner({ modelId: undefined, manufacturer: id === "__other" ? draft.burner.manufacturer : "", model: id === "__other" ? draft.burner.model : "" });
                          }
                        }}
                      >
                        <option value="">Choose…</option>
                        {burnerOptions.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.manufacturer} {b.model}
                            {b.glow === "glow" ? " (Glow)" : b.glow === "non_glow" ? " (non-Glow)" : ""}
                            {b.usedValueCents !== null ? ` · ${formatUsd(b.usedValueCents)} reference` : ""}
                          </option>
                        ))}
                        <option value="__other">Other or not listed</option>
                      </Select>
                    </Field>
                    {!draft.burner.modelId && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Burner manufacturer" htmlFor="brMfr" optional>
                          <TextInput id="brMfr" value={draft.burner.manufacturer ?? ""} onChange={(e) => setBurner({ manufacturer: e.target.value })} />
                        </Field>
                        <Field label="Burner model" htmlFor="brModel" optional>
                          <TextInput id="brModel" value={draft.burner.model ?? ""} onChange={(e) => setBurner({ model: e.target.value })} />
                        </Field>
                      </div>
                    )}
                    <div className="grid gap-7 lg:grid-cols-2">
                      <ChoiceGroup
                        name="brConfig"
                        legend="Configuration"
                        value={draft.burner.configuration}
                        onChange={(v) => setBurner({ configuration: v })}
                        columns={3}
                        choices={[
                          { value: "single", label: "Single" },
                          { value: "double", label: "Double" },
                          { value: "triple", label: "Triple" },
                        ]}
                      />
                      <ChoiceGroup
                        name="brGlow"
                        legend="Glow capability"
                        value={draft.burner.glow}
                        onChange={(v) => {
                          const picked = burnerOptions.find((x) => x.id === draft.burner.modelId);
                          // Switch to the matching Glow or non-Glow entry when one exists.
                          const sibling = picked
                            ? burnerOptions.find((x) => x.manufacturer === picked.manufacturer && x.model === picked.model && (x.glow === v || x.glow === "any"))
                            : undefined;
                          setBurner({ glow: v, modelId: sibling?.id ?? draft.burner.modelId });
                        }}
                        columns={3}
                        choices={[
                          { value: "non_glow", label: "Non-Glow" },
                          { value: "glow", label: "Glow" },
                          { value: "unknown", label: "Not sure" },
                        ]}
                      />
                    </div>
                    <Field label="Year manufactured" htmlFor="brYear" error={errors.burnerYear} hint="Used only when no reference price exists for this burner.">
                      <div className="max-w-[12rem]">
                        <NumberInput id="brYear" value={draft.burner.year} onValue={(v) => setBurner({ year: v })} placeholder="e.g. 2010" invalid={Boolean(errors.burnerYear)} />
                      </div>
                    </Field>
                    <ChoiceGroup name="brCondition" legend="Burner condition" value={draft.burner.condition} onChange={(v) => setBurner({ condition: v })} columns={3} choices={HW_CONDITION_CHOICES} />
                    <Field label="Known resale value" htmlFor="brKnown" optional hint="A known used-market value is used directly and not depreciated again.">
                      <div className="max-w-xs">
                        <MoneyInput id="brKnown" cents={draft.burner.knownResaleCents} onCents={(c) => setBurner({ knownResaleCents: c })} />
                      </div>
                    </Field>
                  </>
                )}
              </>
            )}

            {step === "tanks" && (
              <TankEditor tanks={draft.tanks} onChange={(t) => set("tanks", t)} prices={ref?.tankPrices} />
            )}

            {step === "accessories" && (
              <div className="grid gap-3 sm:grid-cols-2">
                {(ref?.accessories ?? []).map((a) => {
                  const state = draft.accessories[a.key];
                  const on = state?.selected ?? false;
                  return (
                    <CheckTile
                      key={a.key}
                      checked={on}
                      label={a.label}
                      onChange={(v) =>
                        set("accessories", { ...draft.accessories, [a.key]: { ...state, selected: v, valueCents: state?.valueCents ?? a.usedValueCents ?? undefined } })
                      }
                    >
                      {on && (
                        <div className="flex flex-col gap-1.5 pl-6.5" onClick={(e) => e.preventDefault()}>
                          {a.key === "other" && (
                            <TextInput
                              aria-label="Describe the accessory"
                              placeholder="What is it?"
                              value={state?.label ?? ""}
                              onChange={(e) => set("accessories", { ...draft.accessories, [a.key]: { ...state!, label: e.target.value } })}
                            />
                          )}
                          <MoneyInput
                            cents={state?.valueCents}
                            onCents={(c) => set("accessories", { ...draft.accessories, [a.key]: { ...state!, selected: true, valueCents: c } })}
                            placeholder="Estimated resale value"
                          />
                          <span className="text-xs text-muted">
                            {a.usedValueCents !== null ? `Reference ${formatUsd(a.usedValueCents)}. Edit if yours differs.` : "No reference price. Enter an estimate to include it."}
                          </span>
                        </div>
                      )}
                    </CheckTile>
                  );
                })}
              </div>
            )}

            {step === "asking" && (
              <Field label="How much is the seller asking?" htmlFor="asking" optional hint="Leave blank to see the estimated market value only.">
                <div className="max-w-xs">
                  <MoneyInput id="asking" cents={draft.askingPriceCents} onCents={(c) => set("askingPriceCents", c)} placeholder="Asking price" />
                </div>
              </Field>
            )}
          </div>
        </Panel>

        {serverError && (
          <p role="alert" className="mt-4 rounded-md border border-[#e4c3b8] bg-[#fbeee8] px-4 py-3 text-sm text-[#9a3412]">
            {serverError}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="mt-4 text-sm text-[#9a3412]">
            Check the highlighted fields above.
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => go(stepIndex - 1)} disabled={stepIndex === 0}>
            Back
          </Button>
          <div className="flex items-center gap-3">
            {!editId && stepIndex === 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  clearDraft();
                  setDraft(EMPTY);
                }}
              >
                Clear form
              </Button>
            )}
            <Button type="submit" variant={isLast ? "flame" : "primary"} size="lg" disabled={submitting}>
              {isLast ? (submitting ? "Calculating…" : editId ? "Recalculate value" : "Calculate value") : `Continue to ${STEP_LABEL[steps[stepIndex + 1]].toLowerCase()}`}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function IncludeToggle({ name, label, value, onChange }: { name: string; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <ChoiceGroup
      name={name}
      legend={label}
      value={value ? "yes" : "no"}
      onChange={(v) => onChange(v === "yes")}
      columns={2}
      choices={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ]}
    />
  );
}

function FabricMixEditor({ mix, onChange, error }: { mix: FabricShare[]; onChange: (m: FabricShare[]) => void; error?: string }) {
  const total = mix.reduce((n, x) => n + (x.percent || 0), 0);
  return (
    <div className="rounded-[var(--radius-control)] border border-line-soft bg-ivory/50 p-4">
      <p className="text-[0.93rem] font-medium">Fabric breakdown</p>
      <p className="mt-0.5 text-[0.84rem] text-muted">A weighted adjustment is used only when the percentages add up to 100%. Otherwise no fabric adjustment is applied.</p>
      <div className="mt-3 flex flex-col gap-2">
        {mix.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
            <Select aria-label={`Fabric ${i + 1}`} value={s.fabric} onChange={(e) => onChange(mix.map((x, j) => (j === i ? { ...x, fabric: e.target.value as FabricShare["fabric"] } : x)))}>
              <option value="polyester">Polyester</option>
              <option value="nylon">Nylon</option>
              <option value="hyperlast">Hyperlast</option>
              <option value="unknown">Unknown</option>
            </Select>
            <NumberInput aria-label={`Fabric ${i + 1} percent`} decimals value={s.percent || undefined} onValue={(v) => onChange(mix.map((x, j) => (j === i ? { ...x, percent: v ?? 0 } : x)))} suffix="%" />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(mix.filter((_, j) => j !== i))} aria-label={`Remove fabric ${i + 1}`}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...mix, { fabric: "polyester", percent: 0 }])} disabled={mix.length >= 6}>
          Add fabric
        </Button>
        <span className={cn("tabular text-sm", total === 100 ? "text-sage" : "text-muted")}>Total {total}%</span>
      </div>
      {error && <p role="alert" className="mt-2 text-[0.84rem] text-[#9a3412]">{error}</p>}
    </div>
  );
}

function TankEditor({ tanks, onChange, prices }: { tanks: TankInput[]; onChange: (t: TankInput[]) => void; prices?: Reference["tankPrices"] }) {
  const update = (i: number, patch: Partial<TankInput>) => onChange(tanks.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="flex flex-col gap-4">
      {tanks.length === 0 && <p className="text-muted">No tanks added. Add a group of tanks, or continue if none are included.</p>}
      {tanks.map((t, i) => {
        const otherMaker = t.manufacturer !== undefined && !TANK_MAKERS.slice(0, 3).includes(t.manufacturer);
        return (
          <div key={i} className="rounded-[var(--radius-control)] border border-line-soft bg-ivory/40 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Tank group {i + 1}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(tanks.filter((_, j) => j !== i))}>
                Remove
              </Button>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Manufacturer" htmlFor={`tm-${i}`}>
                <Select id={`tm-${i}`} value={otherMaker ? "Other" : (t.manufacturer ?? "")} onChange={(e) => update(i, { manufacturer: e.target.value === "Other" ? "" : e.target.value })}>
                  <option value="">Choose…</option>
                  {TANK_MAKERS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Material" htmlFor={`tmat-${i}`}>
                <Select id={`tmat-${i}`} value={t.material} onChange={(e) => update(i, { material: e.target.value as TankInput["material"] })}>
                  <option value="aluminum">Aluminum</option>
                  <option value="steel">Steel</option>
                  <option value="unknown">Not sure</option>
                </Select>
              </Field>
              <Field label="Capacity" htmlFor={`tcap-${i}`}>
                <Select id={`tcap-${i}`} value={t.capacity ?? ""} onChange={(e) => update(i, { capacity: (e.target.value || undefined) as TankInput["capacity"] })}>
                  <option value="">Not sure</option>
                  <option value="10">10 gallons</option>
                  <option value="15">15 gallons</option>
                  <option value="20">20 gallons</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Quantity" htmlFor={`tq-${i}`}>
                <NumberInput id={`tq-${i}`} value={t.quantity} onValue={(v) => update(i, { quantity: Math.max(1, Math.round(v ?? 1)) })} />
              </Field>
            </div>
            {otherMaker && (
              <TextInput className="mt-3" aria-label="Tank manufacturer" placeholder="Tank manufacturer" value={t.manufacturer ?? ""} onChange={(e) => update(i, { manufacturer: e.target.value })} />
            )}
            {t.capacity === "other" && (
              <div className="mt-3 max-w-[12rem]">
                <NumberInput aria-label="Capacity in gallons" value={t.otherCapacityGallons} onValue={(v) => update(i, { otherCapacityGallons: v })} suffix="gallons" />
              </div>
            )}
            {t.material === "unknown" && (
              <p className="mt-3 rounded-md bg-gold-soft px-3 py-2 text-[0.88rem] text-[#5f4a2a]">
                Can you identify the material? Aluminum and steel tanks are priced very differently. Check the data plate or the tank weight. Until then the
                report counts these as aluminum and shows what they would be worth as steel.
              </p>
            )}
            {t.material === "steel" && t.capacity === "other" && (
              <p className="mt-3 text-[0.88rem] text-muted">There is no reference price for this steel capacity. Enter a known value per tank below.</p>
            )}
            <div className="mt-3 max-w-xs">
              <Field label="Known value per tank" htmlFor={`tk-${i}`} optional>
                <MoneyInput id={`tk-${i}`} cents={t.knownValueEachCents} onCents={(c) => update(i, { knownValueEachCents: c })} />
              </Field>
            </div>
          </div>
        );
      })}
      <div>
        <Button type="button" variant="secondary" onClick={() => onChange([...tanks, { material: "aluminum", quantity: 2 }])}>
          Add tanks
        </Button>
      </div>
      {prices && (
        <p className="text-[0.84rem] text-muted">
          Reference values: aluminum {formatUsd(prices.aluminumCents)} each; steel {formatUsd(prices.steel["10"])} (10 gal), {formatUsd(prices.steel["15"])} (15 gal), {formatUsd(prices.steel["20"])} (20 gal).
        </p>
      )}
    </div>
  );
}

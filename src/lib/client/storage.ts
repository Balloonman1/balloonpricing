"use client";

import type { ValuationInput } from "@/lib/engine/types";

/** Valuations created in this browser. The edit token proves ownership without an account. */
export interface LocalValuation {
  id: string;
  editToken: string;
  referenceNumber: string;
  title: string;
  fairMarketValueCents: number;
  createdAt: string;
}

const LIST_KEY = "bb:mine";
const DRAFT_KEY = "bb:draft";

function read<T>(storage: Storage | undefined, key: string, fallback: T): T {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode). The current page still works.
  }
}

const local = () => (typeof window === "undefined" ? undefined : window.localStorage);
const session = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export function listLocalValuations(): LocalValuation[] {
  return read<LocalValuation[]>(local(), LIST_KEY, []);
}

export function getLocalValuation(id: string): LocalValuation | undefined {
  return listLocalValuations().find((v) => v.id === id);
}

export function saveLocalValuation(v: LocalValuation) {
  const list = listLocalValuations().filter((x) => x.id !== v.id);
  write(local(), LIST_KEY, [v, ...list].slice(0, 100));
}

export function removeLocalValuation(id: string) {
  write(local(), LIST_KEY, listLocalValuations().filter((x) => x.id !== id));
  removeValuationCopy(id);
}

export function saveDraft(draft: unknown) {
  write(session(), DRAFT_KEY, draft);
}

export function loadDraft<T>(): T | null {
  return read<T | null>(session(), DRAFT_KEY, null);
}

export function clearDraft() {
  try {
    session()?.removeItem(DRAFT_KEY);
  } catch {}
}

export function titleFor(input: ValuationInput): string {
  const name = [input.year, input.manufacturer === "Other" ? "" : input.manufacturer, input.model].filter(Boolean).join(" ");
  const scope = { envelope_only: "envelope", complete_system: "complete system", basket_burner: "basket and burner", components: "equipment" }[input.scope];
  return `${name || "Balloon"} ${scope}`.trim();
}

const COPY_KEY = "bb:copies";

/** Full copy of recent valuations so a report still opens if server storage is unavailable. */
export function saveValuationCopy(id: string, valuation: unknown) {
  const copies = read<Record<string, { at: number; v: unknown }>>(local(), COPY_KEY, {});
  copies[id] = { at: Date.now(), v: valuation };
  const trimmed = Object.fromEntries(Object.entries(copies).sort((a, b) => b[1].at - a[1].at).slice(0, 20));
  write(local(), COPY_KEY, trimmed);
}

export function getValuationCopy<T>(id: string): T | null {
  const copies = read<Record<string, { at: number; v: T }>>(local(), COPY_KEY, {});
  return copies[id]?.v ?? null;
}

export function removeValuationCopy(id: string) {
  const copies = read<Record<string, unknown>>(local(), COPY_KEY, {});
  delete copies[id];
  write(local(), COPY_KEY, copies);
}

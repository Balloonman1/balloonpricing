"use client";

import Link from "next/link";
import { forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "flame" | "danger";

const variantClass: Record<Variant, string> = {
  primary: "bg-navy-900 text-ivory hover:bg-navy-800 disabled:bg-navy-500",
  flame: "bg-flame text-white hover:bg-flame-deep disabled:opacity-60",
  secondary: "border border-line bg-paper text-ink hover:border-navy-500 disabled:opacity-50",
  ghost: "text-ink hover:bg-ivory-deep disabled:opacity-50",
  danger: "border border-[#e4c3b8] bg-paper text-[#9a3412] hover:bg-[#fbeee8]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-[0.95rem] font-medium transition-colors disabled:cursor-not-allowed";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" | "sm" }>(
  function Button({ variant = "primary", size = "md", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={cn(base, variantClass[variant], size === "lg" && "px-6 py-3.5 text-base", size === "sm" && "px-3 py-1.5 text-sm", className)}
        {...props}
      />
    );
  },
);

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "md" | "lg" | "sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variantClass[variant], size === "lg" && "px-6 py-3.5 text-base", size === "sm" && "px-3 py-1.5 text-sm", className)}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  error,
  optional,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[0.93rem] font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">optional</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[0.84rem] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-[0.84rem] text-[#9a3412]">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2.5 text-[0.98rem] text-ink placeholder:text-[#9aa1ab] focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15 aria-[invalid=true]:border-[#c2410c]";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(inputClass, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
        <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** Number input that keeps a free-typed string and reports a parsed number (or undefined). */
export function NumberInput({
  value,
  onValue,
  decimals = false,
  suffix,
  id,
  invalid,
  ...props
}: {
  value: number | undefined;
  onValue: (v: number | undefined) => void;
  decimals?: boolean;
  suffix?: string;
  id?: string;
  invalid?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const format = (v: number | undefined) => (v === undefined ? "" : decimals ? String(v) : v.toLocaleString("en-US"));
  const [text, setText] = useState(format(value));
  useEffect(() => {
    const parsed = parse(text);
    if (parsed !== value) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  function parse(t: string): number | undefined {
    const clean = t.replace(/[,\s$]/g, "");
    if (clean === "") return undefined;
    const n = Number(clean);
    return Number.isFinite(n) ? n : undefined;
  }
  return (
    <div className="relative">
      <input
        id={id}
        inputMode={decimals ? "decimal" : "numeric"}
        className={cn(inputClass, "tabular", suffix && "pr-16")}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          onValue(parse(e.target.value));
        }}
        onBlur={() => setText(format(parse(text)))}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
    </div>
  );
}

/** Dollar input. Value is integer cents. */
export function MoneyInput({
  cents,
  onCents,
  id,
  placeholder,
  invalid,
}: {
  cents: number | undefined;
  onCents: (c: number | undefined) => void;
  id?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const fmt = (c: number | undefined) => (c === undefined ? "" : (c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }));
  const [text, setText] = useState(fmt(cents));
  useEffect(() => {
    const parsed = parse(text);
    if (parsed !== cents) setText(fmt(cents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  function parse(t: string): number | undefined {
    const clean = t.replace(/[,\s$]/g, "");
    if (clean === "") return undefined;
    const n = Number(clean);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
      <input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        className={cn(inputClass, "tabular pl-7")}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          onCents(parse(e.target.value));
        }}
        onBlur={() => setText(fmt(parse(text)))}
      />
    </div>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
}

/** Accessible radio group rendered as selectable tiles. */
export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  choices,
  columns = 2,
  legend,
  hint,
  error,
}: {
  name: string;
  value: T | undefined;
  onChange: (v: T) => void;
  choices: Choice<T>[];
  columns?: 1 | 2 | 3 | 4 | 5;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
}) {
  const id = useId();
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5" }[columns];
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="mb-1.5 text-[0.93rem] font-medium text-ink">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="-mt-1 mb-1 text-[0.84rem] text-muted">
          {hint}
        </p>
      )}
      <div className={cn("grid grid-cols-1 gap-2", cols)}>
        {choices.map((c) => {
          const checked = value === c.value;
          return (
            <label
              key={c.value}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-[var(--radius-control)] border bg-paper px-3.5 py-3 transition-colors",
                checked ? "border-navy-900 shadow-[inset_0_0_0_1px_var(--color-navy-900)]" : "border-line hover:border-navy-500",
              )}
            >
              <input type="radio" name={name} value={c.value} checked={checked} onChange={() => onChange(c.value)} className="peer sr-only" />
              <span className="flex items-center gap-2.5 text-[0.95rem] font-medium">
                <span
                  aria-hidden="true"
                  className={cn("grid size-4 shrink-0 place-items-center rounded-full border", checked ? "border-navy-900" : "border-[#b3ab9a]")}
                >
                  {checked && <span className="size-2 rounded-full bg-navy-900" />}
                </span>
                {c.label}
              </span>
              {c.description && <span className="mt-1 pl-6.5 text-[0.84rem] leading-snug text-muted">{c.description}</span>}
              <span className="pointer-events-none absolute inset-0 rounded-[var(--radius-control)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-flame" />
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-[0.84rem] text-[#9a3412]">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function CheckTile({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; children?: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-[var(--radius-control)] border bg-paper px-3.5 py-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-flame",
        checked ? "border-navy-900 shadow-[inset_0_0_0_1px_var(--color-navy-900)]" : "border-line hover:border-navy-500",
      )}
    >
      <span className="flex items-center gap-2.5 text-[0.95rem] font-medium">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] border", checked ? "border-navy-900 bg-navy-900" : "border-[#b3ab9a]")}>
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8">
              <path d="M1 4l2.5 2.5L9 1" fill="none" stroke="#fff" strokeWidth="1.6" />
            </svg>
          )}
        </span>
        {label}
      </span>
      {children}
    </label>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("print-flat rounded-[var(--radius-panel)] border border-line bg-paper", className)}>{children}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "flame" | "gold" | "sage" | "navy"; children: ReactNode }) {
  const tones = {
    neutral: "bg-ivory-deep text-muted",
    flame: "bg-flame-soft text-flame-deep",
    gold: "bg-gold-soft text-[#6f5631]",
    sage: "bg-sage-soft text-sage",
    navy: "bg-navy-900 text-ivory",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium", tones[tone])}>{children}</span>;
}

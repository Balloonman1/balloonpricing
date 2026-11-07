"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Searchable text field with suggestions. Free text is always allowed, so a model
 * that is not in the list can still be entered.
 */
export function Combobox({
  id,
  value,
  onChange,
  onPick,
  options,
  placeholder,
  emptyText = "No matches. Your entry will be used as typed.",
  maxResults = 60,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick?: (o: ComboOption) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyText?: string;
  maxResults?: number;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase().replace(/[\s-]/g, "");
    if (!q) return options.slice(0, maxResults);
    const starts: ComboOption[] = [];
    const contains: ComboOption[] = [];
    for (const o of options) {
      const l = o.label.toLowerCase().replace(/[\s-]/g, "");
      if (l.startsWith(q)) starts.push(o);
      else if (l.includes(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, maxResults);
  }, [value, options, maxResults]);

  const pick = (o: ComboOption) => {
    onChange(o.label);
    onPick?.(o);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        className="w-full rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2.5 text-[0.98rem] text-ink placeholder:text-[#9aa1ab] focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && filtered[active]) {
            e.preventDefault();
            pick(filtered[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-[var(--radius-control)] border border-line bg-paper py-1 shadow-[0_12px_32px_-12px_rgba(18,36,63,0.35)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>}
          {filtered.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-[0.95rem]", i === active && "bg-ivory")}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
            >
              <span>{o.label}</span>
              {o.hint && <span className="tabular shrink-0 text-xs text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

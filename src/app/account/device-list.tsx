"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Panel } from "@/components/ui";
import { listLocalValuations, removeLocalValuation, type LocalValuation } from "@/lib/client/storage";
import { formatUsd } from "@/lib/engine/math";

export function DeviceList() {
  const [items, setItems] = useState<LocalValuation[] | null>(null);
  useEffect(() => setItems(listLocalValuations()), []);

  async function remove(v: LocalValuation) {
    if (!confirm(`Delete ${v.title}? This removes it permanently.`)) return;
    await fetch(`/api/valuations/${v.id}`, { method: "DELETE", headers: { "x-edit-token": v.editToken } });
    removeLocalValuation(v.id);
    setItems(listLocalValuations());
  }

  if (items === null) return <p className="text-muted">Loading…</p>;
  if (items.length === 0)
    return (
      <Panel className="p-8 text-center">
        <p className="text-muted">No valuations on this device yet.</p>
        <ButtonLink href="/value" className="mt-5">
          Value my balloon
        </ButtonLink>
      </Panel>
    );
  return (
    <Panel>
      <ul className="divide-y divide-line-soft">
        {items.map((v) => (
          <li key={v.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <Link href={`/valuation/${v.id}`} className="font-medium hover:text-flame-deep">
                {v.title}
              </Link>
              <p className="tabular text-sm text-muted">
                {v.referenceNumber} · {new Date(v.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="tabular font-serif text-xl">{formatUsd(v.fairMarketValueCents)}</span>
              <Button variant="ghost" size="sm" onClick={() => remove(v)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

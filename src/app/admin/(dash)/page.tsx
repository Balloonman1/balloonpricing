import { Panel } from "@/components/ui";
import { computeStats } from "@/lib/data/stats";
import { getRepository } from "@/lib/data";
import { formatUsd } from "@/lib/engine/math";

export default async function AdminOverview() {
  const repo = getRepository();
  const stats = computeStats(await repo.listValuationStatRows());
  const comps = await repo.listComparables();
  const verified = comps.filter((c) => c.verification === "verified").length;
  const fmt = (n: number | null, digits = 1) => (n === null ? "None yet" : n.toFixed(digits));

  return (
    <div>
      <h1 className="text-3xl">Overview</h1>
      {repo.mode === "demo" && (
        <p className="mt-3 max-w-3xl rounded-md bg-gold-soft px-4 py-3 text-sm text-[#5f4a2a]">
          Demo storage is active because Supabase is not configured. Data is kept on this server only and can be lost on redeploy. Add the Supabase environment variables to persist pricing
          versions, valuations and comparable sales.
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Valuations performed" value={stats.count.toLocaleString("en-US")} sub={`${stats.last30Days} in the last 30 days`} />
        <Stat label="Average estimated value" value={stats.averageValueCents === null ? "None yet" : formatUsd(stats.averageValueCents)} />
        <Stat label="Average envelope age" value={stats.averageEnvelopeAge === null ? "None yet" : `${fmt(stats.averageEnvelopeAge)} years`} />
        <Stat label="Average envelope hours" value={stats.averageEnvelopeHours === null ? "None yet" : `${fmt(stats.averageEnvelopeHours, 0)} h`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel className="p-6">
          <h2 className="font-sans text-base font-semibold">Most common manufacturers</h2>
          {stats.topManufacturers.length ? (
            <ul className="mt-3 divide-y divide-line-soft">
              {stats.topManufacturers.map((m) => (
                <li key={m.manufacturer} className="flex justify-between py-2">
                  <span>{m.manufacturer}</span>
                  <span className="tabular text-muted">{m.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-muted">No valuations yet.</p>
          )}
        </Panel>
        <Panel className="p-6">
          <h2 className="font-sans text-base font-semibold">Asking prices entered by users</h2>
          <p className="tabular mt-3 font-serif text-3xl">
            {stats.averageOverpricingPct === null ? "None yet" : `${stats.averageOverpricingPct >= 0 ? "+" : ""}${stats.averageOverpricingPct.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-sm text-muted">Average difference from estimated value across {stats.askingSampleSize} valuations with an asking price.</p>
          <p className="mt-4 text-sm text-muted">
            This only reflects listings people chose to check here, which skews toward prices that looked high. It is not a measure of the whole market.
          </p>
          <h2 className="mt-6 font-sans text-base font-semibold">Comparable sales</h2>
          <p className="mt-1 text-muted">
            {comps.length} records, {verified} verified completed sales.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Panel className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-1 font-serif text-2xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Panel>
  );
}

import { Panel } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { accuracyBreakdown, predictComparables, suggestAdjustments } from "@/lib/engine/calibration";
import { formatUsd } from "@/lib/engine/math";
import { ApproveButton } from "./approve";

export default async function CalibrationPage() {
  const repo = getRepository();
  const [comps, active] = await Promise.all([repo.listComparables(), repo.getActiveConfig()]);
  const preds = predictComparables(comps, active.snapshot);
  const groups = accuracyBreakdown(preds);
  const suggestions = suggestAdjustments(preds, active.snapshot);
  const apes = preds.map((p) => p.absolutePercentageError).filter((x): x is number => x !== null);
  const mape = apes.length ? apes.reduce((n, x) => n + x, 0) / apes.length : null;
  const dims = [...new Set(groups.map((g) => g.dimension))];

  return (
    <div>
      <h1 className="text-3xl">Calibration</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Each verified completed sale with equipment details is valued with the active pricing (v{active.version}) as of its sale date and compared with the price it actually sold for. Suggestions
        need at least three sales from one manufacturer and are never applied without approval.
      </p>

      {preds.length === 0 ? (
        <Panel className="mt-6 p-8 text-center text-muted">No verified completed sales with equipment details yet. Add them under Comparable sales.</Panel>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Panel className="p-5">
              <p className="text-sm text-muted">Sales evaluated</p>
              <p className="tabular font-serif text-2xl">{preds.length}</p>
            </Panel>
            <Panel className="p-5">
              <p className="text-sm text-muted">Mean absolute percentage error</p>
              <p className="tabular font-serif text-2xl">{mape === null ? "None" : `${mape.toFixed(1)}%`}</p>
            </Panel>
            <Panel className="p-5">
              <p className="text-sm text-muted">Mean error (actual minus predicted)</p>
              <p className="tabular font-serif text-2xl">{formatUsd(Math.abs(preds.reduce((n, p) => n + p.errorCents, 0) / preds.length))}</p>
              <p className="text-xs text-muted">{preds.reduce((n, p) => n + p.errorCents, 0) >= 0 ? "Model tends to estimate low" : "Model tends to estimate high"}</p>
            </Panel>
          </div>

          <section className="mt-8">
            <h2 className="text-2xl">Suggested adjustments</h2>
            {suggestions.length === 0 ? (
              <p className="mt-3 text-muted">No manufacturer has enough verified sales, or the model is already within 5% of actual prices.</p>
            ) : (
              <Panel className="mt-4">
                <table className="w-full text-[0.93rem]">
                  <thead>
                    <tr className="border-b border-line text-left text-sm text-muted">
                      <th className="px-4 py-3 font-normal">Manufacturer</th>
                      <th className="px-4 py-3 text-right font-normal">Sales</th>
                      <th className="px-4 py-3 text-right font-normal">Median actual ÷ predicted</th>
                      <th className="px-4 py-3 text-right font-normal">Current</th>
                      <th className="px-4 py-3 text-right font-normal">Suggested</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => (
                      <tr key={s.manufacturer} className="border-b border-line-soft">
                        <td className="px-4 py-3">{s.manufacturer}</td>
                        <td className="tabular px-4 py-3 text-right">{s.sampleSize}</td>
                        <td className="tabular px-4 py-3 text-right">{s.medianRatio.toFixed(3)}</td>
                        <td className="tabular px-4 py-3 text-right">×{s.currentAdjustment.toFixed(2)}</td>
                        <td className="tabular px-4 py-3 text-right font-medium">×{s.suggestedAdjustment.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <ApproveButton manufacturer={s.manufacturer} adjustment={s.suggestedAdjustment} sampleSize={s.sampleSize} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-2xl">Accuracy by group</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {dims.map((d) => (
                <Panel key={d} className="p-5">
                  <h3 className="font-sans text-[0.95rem] font-semibold">{d}</h3>
                  <table className="mt-2 w-full text-[0.9rem]">
                    <tbody>
                      {groups
                        .filter((g) => g.dimension === d)
                        .map((g) => (
                          <tr key={g.bucket} className="border-t border-line-soft">
                            <td className="py-1.5">{g.bucket}</td>
                            <td className="tabular py-1.5 text-right text-muted">{g.count} {g.count === 1 ? "sale" : "sales"}</td>
                            <td className="tabular py-1.5 text-right">{g.meanAbsPctError === null ? "" : `${g.meanAbsPctError.toFixed(1)}% error`}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </Panel>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl">Sale by sale</h2>
            <Panel className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-[0.93rem]">
                <thead>
                  <tr className="border-b border-line text-left text-sm text-muted">
                    <th className="px-4 py-3 font-normal">Balloon</th>
                    <th className="px-4 py-3 font-normal">Sold</th>
                    <th className="px-4 py-3 text-right font-normal">Actual</th>
                    <th className="px-4 py-3 text-right font-normal">Predicted</th>
                    <th className="px-4 py-3 text-right font-normal">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {preds.map((p) => (
                    <tr key={p.comparable.id} className="border-b border-line-soft">
                      <td className="px-4 py-3">{[p.comparable.year, p.comparable.manufacturer, p.comparable.model].filter(Boolean).join(" ")}</td>
                      <td className="tabular px-4 py-3">{p.comparable.dateSold}</td>
                      <td className="tabular px-4 py-3 text-right">{formatUsd(p.actualCents)}</td>
                      <td className="tabular px-4 py-3 text-right">{formatUsd(p.predictedCents)}</td>
                      <td className="tabular px-4 py-3 text-right">
                        {p.errorCents >= 0 ? "+" : "−"}
                        {formatUsd(Math.abs(p.errorCents))}
                        {p.absolutePercentageError !== null && <span className="ml-1 text-muted">({p.absolutePercentageError.toFixed(1)}%)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}

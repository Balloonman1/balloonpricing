import { describe, expect, it } from "vitest";
import { comparablesFromCsv, comparablesToCsv, parseCsv } from "@/lib/comparables-csv";
import { accuracyBreakdown, predictComparables, predictionError, suggestAdjustments } from "@/lib/engine/calibration";
import { DEFAULT_CONFIG } from "@/lib/engine/defaults";

const HEADER = "manufacturer,model,volume_cuft,year,hours,category,scope,fabric,condition,basket_year,burner_manufacturer,burner_model,burner_glow,tank_material,tank_capacity,tank_quantity,asking_price,sale_price,date_sold,region,source,verification";

describe("CSV parsing", () => {
  it("handles quotes, commas and blank lines", () => {
    expect(parseCsv('a,"b, c","d ""q"""\n\n1,2,3\r\n')).toEqual([["a", "b, c", 'd "q"'], ["1", "2", "3"]]);
  });

  it("imports comparables with structured inputs and rejects bad rows", () => {
    const csv = [
      HEADER,
      "Cameron,O-90,90000,2012,210,sport,complete_system,polyester,B,2012,Cameron,Super Doubles,non_glow,aluminum,10,3,26000,21500,2026-04-12,Pacific Northwest,Owner report,verified",
      "Cameron,O-90,90000,2012,210,sport,complete_system,polyester,B,,,,,,,,24000,20000,,,Listing,asking",
      "Ultramagic,M-77,77000,2015,150,sport,envelope_only,nylon,C,,,,,,,,,,,,,reported",
      "Lindstrand,,,,,,,,,,,,,,,,,15000,,,,verified",
    ].join("\n");
    const { comparables, errors } = comparablesFromCsv(csv);
    expect(comparables).toHaveLength(2);
    expect(errors.map((e) => e.line)).toEqual([3, 5]);
    const [verified] = comparables;
    expect(verified.salePriceCents).toBe(2150000);
    expect(verified.valuationInput?.burner?.model).toBe("Super Doubles");
    expect(verified.valuationInput?.tanks).toEqual([{ material: "aluminum", quantity: 3, capacity: "10" }]);
    expect(comparables[1].valuationInput?.scope).toBe("envelope_only");
  });

  it("round-trips through export", () => {
    const csv = [HEADER, "Cameron,O-90,90000,2012,210,sport,complete_system,polyester,B,2012,Cameron,Super Doubles,non_glow,aluminum,10,3,26000,21500,2026-04-12,PNW,Owner,verified"].join("\n");
    const first = comparablesFromCsv(csv).comparables;
    const again = comparablesFromCsv(comparablesToCsv(first)).comparables;
    expect(again[0].salePriceCents).toBe(first[0].salePriceCents);
    expect(again[0].valuationInput).toEqual(first[0].valuationInput);
  });
});

describe("calibration", () => {
  it("computes prediction error and absolute percentage error without dividing by zero", () => {
    expect(predictionError(2000000, 1800000)).toEqual({ errorCents: 200000, absolutePercentageError: 10 });
    expect(predictionError(0, 1800000).absolutePercentageError).toBeNull();
  });

  it("uses only verified sales and suggests, never applies, adjustments", () => {
    const input = comparablesFromCsv(
      [HEADER, "Cameron,O-90,90000,2012,210,sport,complete_system,polyester,B,2012,Cameron,Super Doubles,non_glow,aluminum,10,3,,21500,2026-04-12,PNW,Owner,verified"].join("\n"),
    ).comparables[0];
    const comps = [1, 2, 3].map((i) => ({ ...input, id: String(i), salePriceCents: 2500000 }));
    comps.push({ ...input, id: "x", verification: "reported" as const, salePriceCents: 100 });
    const preds = predictComparables(comps, DEFAULT_CONFIG);
    expect(preds).toHaveLength(3);
    const suggestions = suggestAdjustments(preds, DEFAULT_CONFIG);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].manufacturer).toBe("Cameron");
    expect(suggestions[0].suggestedAdjustment).toBeGreaterThan(1);
    expect(DEFAULT_CONFIG.manufacturerAdjustments).toEqual({});
    // One sale alone never produces a suggestion.
    expect(suggestAdjustments(preds.slice(0, 1), DEFAULT_CONFIG)).toHaveLength(0);
    const groups = accuracyBreakdown(preds);
    expect(groups.find((g) => g.dimension === "Manufacturer" && g.bucket === "Cameron")?.count).toBe(3);
  });
});

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { caseA } from "@/lib/engine/__tests__/fixtures";

process.env.DEMO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "bluebook-"));

const { demoRepository: repo, resetDemoStore } = await import("@/lib/data/demo-store");
const { canEdit, createValuation, recalculateValuation, reproduceValuation, publicView, supportingComparables } = await import("@/lib/services/valuations");
const { DEFAULT_CONFIG } = await import("@/lib/engine/defaults");

beforeEach(() => resetDemoStore());

describe("configuration versions", () => {
  it("creates a new version on every change and keeps old versions intact", async () => {
    const v1 = await repo.getActiveConfig();
    expect(v1.version).toBe(1);
    const { version: _v, ...rest } = v1.snapshot;
    const v2 = await repo.createConfigVersion({ ...rest, listingMarkup: 0.12 }, { label: "Higher markup" });
    expect(v2.version).toBe(2);
    expect((await repo.getActiveConfig()).version).toBe(2);
    expect((await repo.getConfigByVersion(1))!.snapshot.listingMarkup).toBe(0.08);
    expect((await repo.getConfigByVersion(2))!.snapshot.listingMarkup).toBe(0.12);
    await repo.activateConfig(1);
    expect((await repo.getActiveConfig()).version).toBe(1);
    expect((await repo.listConfigs()).map((c) => c.version)).toEqual([2, 1]);
  });
});

describe("stored valuations", () => {
  it("reproduces a historical valuation under the configuration it used", async () => {
    const created = await createValuation(repo, caseA);
    if (!created.ok) throw new Error("validation failed");
    const original = created.valuation;
    expect(original.configVersion).toBe(1);

    // Change pricing after the fact.
    const { version: _v, ...rest } = DEFAULT_CONFIG;
    await repo.createConfigVersion({ ...rest, tankPrices: { ...rest.tankPrices, aluminumCents: 99900 } }, { label: "test" });

    const reproduced = await reproduceValuation(repo, original);
    expect(reproduced!.result.fairMarketValueCents).toBe(original.result.fairMarketValueCents);
    expect(reproduced!.result.components.map((c) => c.valueCents)).toEqual(original.result.components.map((c) => c.valueCents));

    // Recalculating explicitly moves it to the new version.
    const recalced = await recalculateValuation(repo, original, caseA);
    if (!recalced.ok) throw new Error("validation failed");
    expect(recalced.valuation.configVersion).toBe(2);
    expect(recalced.valuation.result.components.find((c) => c.kind === "tanks")!.valueCents).toBe(4 * 99900);
  });

  it("guards edits with the creator token and hides private fields in public views", async () => {
    const created = await createValuation(repo, {
      ...caseA,
      envelope: { ...caseA.envelope!, inspection: { majorRepairs: "Private repair note" } },
    });
    if (!created.ok) throw new Error("validation failed");
    expect(canEdit(created.valuation, created.editToken, null)).toBe(true);
    expect(canEdit(created.valuation, "wrong", null)).toBe(false);
    expect(canEdit(created.valuation, null, "someone")).toBe(false);
    const pub = publicView(created.valuation);
    expect(JSON.stringify(pub)).not.toContain("Private repair note");
    expect(JSON.stringify(pub)).not.toContain(created.valuation.editTokenHash);
    expect(pub.shareId).toBeNull();
  });

  it("rejects invalid input server-side", async () => {
    const r = await createValuation(repo, { manufacturer: "", scope: "envelope_only", category: "sport" });
    expect(r.ok).toBe(false);
  });
});

describe("comparables", () => {
  it("only counts verified completed sales with structured input as support", async () => {
    const base = { manufacturer: "Cameron", dateSold: "2026-05-01", valuationInput: caseA };
    const comps = [
      { ...base, id: "1", verification: "verified" as const, salePriceCents: 1500000 },
      { ...base, id: "2", verification: "reported" as const, salePriceCents: 1500000 },
      { ...base, id: "3", verification: "asking" as const, askingPriceCents: 2000000 },
      { ...base, id: "4", verification: "verified" as const, salePriceCents: 1500000, valuationInput: { ...caseA, volumeCuFt: 140000 } },
    ];
    expect(supportingComparables(caseA, comps)).toBe(1);
  });
});

describe("automatic reference updates on stored pricing", () => {
  it("creates a new version when stored pricing predates an update", async () => {
    const { withDefaultsUpgrades } = await import("@/lib/data/upgrade-wrapper");
    const wrapped = withDefaultsUpgrades(repo);
    const { version: _v, defaultsApplied: _d, ...old } = DEFAULT_CONFIG;
    void _v;
    void _d;
    await repo.createConfigVersion({ ...old, basketModels: old.basketModels.filter((b) => b.manufacturer !== "Firefly") }, { label: "old" });
    const active = await wrapped.getActiveConfig();
    expect(active.version).toBe(3);
    expect(active.snapshot.basketModels.filter((b) => b.manufacturer === "Firefly")).toHaveLength(8);
    expect((await wrapped.getActiveConfig()).version).toBe(3);
  });
});

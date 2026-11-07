import { describe, expect, it } from "vitest";
import { applyDefaultsUpgrades, DEFAULT_CONFIG, FIREFLY_BASKET_SIZES } from "@/lib/engine/defaults";
import type { ValuationConfig, ValuationInput } from "@/lib/engine/types";
import { valuate } from "@/lib/engine/valuate";

const AS_OF = new Date("2026-06-15T12:00:00Z");
const system = (manufacturer: string): ValuationInput => ({
  manufacturer,
  model: "8B-15",
  volumeCuFt: 90000,
  year: 2016,
  hours: 100,
  category: "sport",
  scope: "complete_system",
  envelope: { fabric: "polyester", condition: "B", appearance: "warm", heavyBranding: false },
  basket: { manufacturer: "Firefly", model: "4.2 basket", modelId: "basket-firefly-4-2", year: 2016 },
  burner: { manufacturer: "Firefly", model: "T3", modelId: "burner-firefly-t3", glow: "unknown", year: 2016 },
});

describe("Firefly and Balloon Works", () => {
  it("applies the Firefly cap to Balloon Works under any of its names", () => {
    for (const name of ["Firefly", "Balloon Works", "The Balloon Works"]) {
      const r = valuate(system(name), DEFAULT_CONFIG, { asOf: AS_OF });
      expect(r.fairMarketValueCents).toBe(750000);
      expect(r.policies[0].code).toBe("brand_cap");
    }
  });

  it("lists every Firefly basket size and the Mirage and T3 burners without inventing prices", () => {
    const baskets = DEFAULT_CONFIG.basketModels.filter((b) => b.manufacturer === "Firefly");
    expect(baskets.map((b) => b.model)).toEqual(FIREFLY_BASKET_SIZES.map((s) => `${s} basket`));
    expect(baskets.every((b) => b.newPriceCents === null)).toBe(true);
    const burners = DEFAULT_CONFIG.burnerModels.filter((b) => b.manufacturer === "Firefly").map((b) => [b.model, b.usedValueCents]);
    expect(burners).toEqual([
      ["Mirage", null],
      ["T3", null],
    ]);
  });

  it("flags unpriced Firefly burners as generic estimates", () => {
    const r = valuate(system("Firefly"), DEFAULT_CONFIG, { asOf: AS_OF });
    expect(r.flags.some((f) => f.code === "burner_model_unpriced")).toBe(true);
  });
});

describe("built-in reference updates", () => {
  const oldConfig = (): ValuationConfig => {
    const c = structuredClone(DEFAULT_CONFIG);
    c.basketModels = c.basketModels.filter((b) => b.manufacturer !== "Firefly");
    c.burnerModels = c.burnerModels.filter((b) => b.manufacturer !== "Firefly");
    c.brandPolicies = c.brandPolicies.map((p) => ({ ...p, aliases: undefined }));
    delete c.defaultsApplied;
    return c;
  };

  it("adds missing entries to an older configuration once, keeping its prices", () => {
    const before = oldConfig();
    before.tankPrices.aluminumCents = 30000;
    const { config, applied } = applyDefaultsUpgrades(before);
    expect(applied).toHaveLength(2);
    expect(config.basketModels.filter((b) => b.manufacturer === "Firefly")).toHaveLength(8);
    expect(config.burnerModels.filter((b) => b.manufacturer === "Firefly")).toHaveLength(2);
    expect(config.brandPolicies.find((p) => p.manufacturer === "Firefly")?.aliases).toContain("Balloon Works");
    expect(config.tankPrices.aluminumCents).toBe(30000);
    expect(applyDefaultsUpgrades(config).applied).toHaveLength(0);
  });

  it("does not bring back entries an administrator removed later", () => {
    const { config } = applyDefaultsUpgrades(oldConfig());
    const edited = { ...config, basketModels: config.basketModels.filter((b) => b.id !== "basket-firefly-3-9") };
    expect(applyDefaultsUpgrades(edited).applied).toHaveLength(0);
  });

  it("leaves the current defaults unchanged", () => {
    expect(applyDefaultsUpgrades(DEFAULT_CONFIG).applied).toHaveLength(0);
  });
});

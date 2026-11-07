import type { ValuationInput } from "../types";

const $ = (dollars: number) => Math.round(dollars * 100);

/** Reference cases from the specification (section 29). */
export const caseA: ValuationInput = {
  manufacturer: "Cameron",
  model: "O-90",
  volumeCuFt: 90000,
  year: 2003,
  hours: 150,
  category: "sport",
  scope: "complete_system",
  envelope: { fabric: "nylon", condition: "B", appearance: "warm", heavyBranding: false },
  basket: { manufacturer: "Aristocrat", model: "42 × 52", year: 2003, dimensions: "42 x 52" },
  burner: { manufacturer: "Cameron", model: "Super Doubles", modelId: "burner-cameron-super-doubles", glow: "unknown" },
  tanks: [{ manufacturer: "Worthington", material: "aluminum", capacity: "10", quantity: 4 }],
};

export const caseB: ValuationInput = {
  manufacturer: "Aerostar",
  model: "RX-7",
  volumeCuFt: 77000,
  year: 2007,
  hours: 106.56,
  category: "sport",
  scope: "complete_system",
  envelope: { fabric: "nylon", condition: "A", appearance: "warm", heavyBranding: false },
  basket: { manufacturer: "Aerostar", model: "RWSW-AFX", modelId: "basket-aerostar-rwsw-afx" },
  burner: { manufacturer: "Aerostar", model: "Zone V Double", modelId: "burner-aerostar-zone-v-double-nonglow", glow: "non_glow" },
  tanks: [{ material: "aluminum", quantity: 2 }],
};

export const caseC: ValuationInput = {
  manufacturer: "Cameron",
  model: "C-80",
  volumeCuFt: 80000,
  year: 2008,
  hours: 285,
  category: "sport",
  scope: "envelope_only",
  envelope: {
    fabric: "mixed",
    fabricMix: [{ fabric: "hyperlast", percent: 25 }],
    appearance: "warm",
    heavyBranding: false,
  },
};

const caseDEnvelope = {
  manufacturer: "Other",
  model: "Racer",
  year: 2023,
  hours: 100,
  category: "racer" as const,
  envelope: { fabric: "unknown" as const, condition: "A" as const, appearance: "warm" as const, heavyBranding: false, knownReplacementCostCents: $(23000) },
};

export const caseDEnvelopeOnly: ValuationInput = { ...caseDEnvelope, scope: "envelope_only", askingPriceCents: $(19000) };
export const caseDComplete: ValuationInput = {
  ...caseDEnvelope,
  scope: "complete_system",
  basket: { manufacturer: "Kubicek", model: "K13s", modelId: "basket-kubicek-k13s", construction: "lightweight" },
  burner: { manufacturer: "Ignis", model: "Plus Double", modelId: "burner-ignis-plus-double", glow: "unknown", configuration: "double" },
  tanks: [{ manufacturer: "Prince", material: "unknown", quantity: 2 }],
  askingPriceCents: $(39000),
};


import type { ValuationInput } from "@/lib/engine/types";

/** Reference cases from the specification, used for admin previews of pricing changes. */
export const REFERENCE_CASES: { name: string; input: ValuationInput }[] = [
  {
    name: "Cameron O-90, 2003, 150 h, complete",
    input: {
      manufacturer: "Cameron", model: "O-90", volumeCuFt: 90000, year: 2003, hours: 150, category: "sport", scope: "complete_system",
      envelope: { fabric: "nylon", condition: "B", appearance: "warm", heavyBranding: false },
      basket: { manufacturer: "Aristocrat", year: 2003 },
      burner: { manufacturer: "Cameron", model: "Super Doubles", modelId: "burner-cameron-super-doubles", glow: "unknown" },
      tanks: [{ manufacturer: "Worthington", material: "aluminum", quantity: 4 }],
    },
  },
  {
    name: "Aerostar RX-7, 2007, 106.56 h, complete",
    input: {
      manufacturer: "Aerostar", model: "RX-7", volumeCuFt: 77000, year: 2007, hours: 106.56, category: "sport", scope: "complete_system",
      envelope: { fabric: "nylon", condition: "A", appearance: "warm", heavyBranding: false },
      basket: { manufacturer: "Aerostar", model: "RWSW-AFX" },
      burner: { manufacturer: "Aerostar", model: "Zone V Double", modelId: "burner-aerostar-zone-v-double-nonglow", glow: "non_glow" },
      tanks: [{ material: "aluminum", quantity: 2 }],
    },
  },
  {
    name: "Cameron C-80, 2008, 285 h, envelope only",
    input: {
      manufacturer: "Cameron", model: "C-80", volumeCuFt: 80000, year: 2008, hours: 285, category: "sport", scope: "envelope_only",
      envelope: { fabric: "mixed", fabricMix: [{ fabric: "hyperlast", percent: 25 }], appearance: "warm", heavyBranding: false },
    },
  },
  {
    name: "Modern racer, 2023, 100 h, envelope only",
    input: {
      manufacturer: "Other", year: 2023, hours: 100, category: "racer", scope: "envelope_only",
      envelope: { fabric: "unknown", condition: "A", appearance: "warm", heavyBranding: false, knownReplacementCostCents: 2300000 },
    },
  },
  {
    name: "Firefly 8B-15, 2010, 250 h, complete",
    input: {
      manufacturer: "Firefly", model: "8B-15", volumeCuFt: 90000, year: 2010, hours: 250, category: "sport", scope: "complete_system",
      envelope: { fabric: "polyester", condition: "C", appearance: "warm", heavyBranding: false },
      basket: { year: 2010 }, burner: { glow: "non_glow", year: 2010 },
    },
  },
];

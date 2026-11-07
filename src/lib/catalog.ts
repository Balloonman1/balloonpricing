import catalog from "@/data/model-catalog.json";

export interface CatalogModel {
  model: string;
  count: number;
  volumeCuFt: number | null;
  otherVolumes: number[];
  category: "sport" | "commercial" | "racer" | "special_shape";
  yearMin: number | null;
  yearMax: number | null;
}

export interface CatalogManufacturer {
  name: string;
  primary: boolean;
  registryFamilies: string[];
  models: CatalogModel[];
}

export const CATALOG = catalog as unknown as {
  source: { name: string; url: string; via: string; exported: string | null };
  generated: string;
  recordCount: number;
  manufacturers: CatalogManufacturer[];
};

export const PRIMARY_MANUFACTURERS = CATALOG.manufacturers.filter((m) => m.primary).map((m) => m.name);
export const MORE_MANUFACTURERS = CATALOG.manufacturers.filter((m) => !m.primary && m.name !== "Experimental").map((m) => m.name);

export function modelsFor(manufacturer: string): CatalogModel[] {
  return CATALOG.manufacturers.find((m) => m.name === manufacturer)?.models ?? [];
}

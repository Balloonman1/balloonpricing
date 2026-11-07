import { describe, expect, it, vi } from "vitest";
import { caseA } from "@/lib/engine/__tests__/fixtures";
import { valuate } from "@/lib/engine/valuate";
import { DEFAULT_CONFIG } from "@/lib/engine/defaults";

// In-memory stand-in for Netlify Blobs with the same API surface used by the store.
const mem = new Map<string, string>();
vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    get: async (key: string) => (mem.has(key) ? JSON.parse(mem.get(key)!) : null),
    setJSON: async (key: string, value: unknown, opts?: { onlyIfNew?: boolean }) => {
      if (opts?.onlyIfNew && mem.has(key)) return { modified: false };
      mem.set(key, JSON.stringify(value));
      return { modified: true };
    },
    delete: async (key: string) => void mem.delete(key),
    list: async ({ prefix }: { prefix: string }) => ({ blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
  }),
}));

const { blobsRepository: repo } = await import("@/lib/data/blobs-store");

describe("Netlify Blobs repository", () => {
  it("seeds, versions and activates configuration", async () => {
    expect((await repo.getActiveConfig()).version).toBe(1);
    const { version: _v, ...rest } = DEFAULT_CONFIG;
    const v2 = await repo.createConfigVersion({ ...rest, listingMarkup: 0.1 }, { label: "t" });
    expect(v2.version).toBe(2);
    expect((await repo.getActiveConfig()).snapshot.listingMarkup).toBe(0.1);
    await repo.activateConfig(1);
    expect((await repo.getActiveConfig()).version).toBe(1);
    expect((await repo.listConfigs()).map((c) => [c.version, c.isActive])).toEqual([
      [2, false],
      [1, true],
    ]);
  });

  it("stores valuations, shares them and revokes links", async () => {
    const result = valuate(caseA, DEFAULT_CONFIG);
    const v = await repo.insertValuation({ referenceNumber: "BB-1", userId: null, configVersion: 1, engineVersion: "1", input: caseA, result, editTokenHash: "h" });
    expect((await repo.getValuation(v.id))?.referenceNumber).toBe("BB-1");
    await repo.updateValuation(v.id, { isShared: true, shareId: "share-abcdefghijklmnop" });
    expect((await repo.getValuationByShareId("share-abcdefghijklmnop"))?.id).toBe(v.id);
    await repo.updateValuation(v.id, { isShared: false, shareId: null });
    expect(await repo.getValuationByShareId("share-abcdefghijklmnop")).toBeNull();
    expect((await repo.listValuationStatRows()).length).toBe(1);
    await repo.deleteValuation(v.id);
    expect(await repo.getValuation(v.id)).toBeNull();
  });

  it("keeps comparables", async () => {
    const c = await repo.upsertComparable({ id: "", manufacturer: "Cameron", verification: "asking", askingPriceCents: 100 });
    expect((await repo.listComparables()).map((x) => x.id)).toEqual([c.id]);
    await repo.deleteComparable(c.id);
    expect(await repo.listComparables()).toEqual([]);
  });
});

import { applyDefaultsUpgrades } from "@/lib/engine/defaults";
import type { ConfigRecord, Repository } from "./types";

/**
 * When the stored pricing predates a built-in reference update (for example new basket
 * or burner entries), apply it once as a new pricing version. Prices are never changed.
 */
export function withDefaultsUpgrades(base: Repository): Repository {
  let inflight: Promise<ConfigRecord> | null = null;
  return {
    ...base,
    async getActiveConfig() {
      const active = await base.getActiveConfig();
      const { config, applied } = applyDefaultsUpgrades(active.snapshot);
      if (applied.length === 0) return active;
      if (!inflight) {
        const { version: _v, ...snapshot } = config;
        void _v;
        inflight = base
          .createConfigVersion(snapshot, { label: applied.join("; "), notes: "Built-in reference update applied automatically. No prices were changed.", createdBy: "system" })
          .catch(() => base.getActiveConfig())
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
  };
}


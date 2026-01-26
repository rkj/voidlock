import { describe, it, expect, beforeEach } from "vitest";
import { MetaManager } from "@src/engine/managers/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("MetaManager Validation", () => {
  let storage: MockStorageProvider;
  let manager: MetaManager;
  const STORAGE_KEY = "voidlock_meta_v1";

  beforeEach(() => {
    storage = new MockStorageProvider();
    MetaManager.resetInstance();
  });

  it("should handle corrupted meta stats in storage", () => {
    storage.save(STORAGE_KEY, { totalKills: "lots" });

    manager = MetaManager.getInstance(storage);
    const stats = manager.getStats();

    expect(typeof stats.totalKills).toBe("number");
    expect(stats.totalKills).toBe(0);
    expect(stats.totalCampaignsStarted).toBe(0);
  });

  it("should handle missing fields in meta stats", () => {
    storage.save(STORAGE_KEY, { totalKills: 100 });

    manager = MetaManager.getInstance(storage);
    const stats = manager.getStats();

    expect(stats.totalKills).toBe(100);
    expect(stats.totalCampaignsStarted).toBe(0);
    expect(stats.campaignsWon).toBe(0);
  });
});

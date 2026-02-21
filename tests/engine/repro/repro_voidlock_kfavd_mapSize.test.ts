import { describe, it, expect, beforeEach } from "vitest";
import { calculateMapSize, calculateSpawnPoints } from "@src/shared/campaign_types";
import { CampaignManager } from "@src/engine/campaign/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("repro_voidlock_kfavd_mapSize", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should calculate map size correctly based on Rank (0-indexed rank)", () => {
    const growthRate = 0.5;

    expect(calculateMapSize(0, growthRate)).toBe(6);
    expect(calculateMapSize(1, growthRate)).toBe(6);
    expect(calculateMapSize(2, growthRate)).toBe(7);
    expect(calculateMapSize(3, growthRate)).toBe(7);
    expect(calculateMapSize(4, growthRate)).toBe(8);
  });

  it("should calculate spawn points correctly based on map size", () => {
    expect(calculateSpawnPoints(6)).toBe(1);
    expect(calculateSpawnPoints(7)).toBe(1);
    expect(calculateSpawnPoints(8)).toBe(2);
    expect(calculateSpawnPoints(9)).toBe(2);
    expect(calculateSpawnPoints(10)).toBe(3);
    expect(calculateSpawnPoints(11)).toBe(3);
    expect(calculateSpawnPoints(12)).toBe(4);
  });

  it("should verify Campaign nodes size calculation matches spec", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    const growthRate = state.rules.mapGrowthRate;
    
    expect(growthRate).toBe(0.5);

    // Rank 0 (Spec Rank 1)
    const size0 = calculateMapSize(0, growthRate);
    expect(size0).toBe(6);
    expect(calculateSpawnPoints(size0)).toBe(1);

    // Rank 1 (Spec Rank 2)
    const size1 = calculateMapSize(1, growthRate);
    expect(size1).toBe(6);
    expect(calculateSpawnPoints(size1)).toBe(1);

    // Rank 2 (Spec Rank 3)
    const size2 = calculateMapSize(2, growthRate);
    expect(size2).toBe(7);
    expect(calculateSpawnPoints(size2)).toBe(1);

    // Rank 4 (Spec Rank 5)
    const size4 = calculateMapSize(4, growthRate);
    expect(size4).toBe(8);
    expect(calculateSpawnPoints(size4)).toBe(2);
  });
});

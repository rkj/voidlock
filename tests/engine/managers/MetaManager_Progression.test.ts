import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("MetaManager Progression", () => {
  let storage: MockStorageProvider;
  let metaManager: MetaManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    
    metaManager = new MetaManager(storage);
  });

  it("should initialize with default values", () => {
    const stats = metaManager.getStats();
    expect(stats.currentIntel).toBe(0);
    expect(stats.unlockedArchetypes).toEqual([]);
    expect(stats.unlockedItems).toEqual([]);
  });

  it("should record intel gained from missions", () => {
    metaManager.recordMissionResult({ kills: 10, casualties: 0, won: true, scrapGained: 100, intelGained: 50 });
    expect(metaManager.getStats().currentIntel).toBe(50);
  });

  it("should allow spending intel to unlock archetypes", () => {
    metaManager.recordMissionResult({ kills: 0, casualties: 0, won: true, scrapGained: 0, intelGained: 100 });

    metaManager.unlockArchetype("heavy", 50);

    const stats = metaManager.getStats();
    expect(stats.currentIntel).toBe(50);
    expect(stats.unlockedArchetypes).toContain("heavy");
    expect(metaManager.isArchetypeUnlocked("heavy")).toBe(true);
  });

  it("should throw error if insufficient intel to unlock archetype", () => {
    expect(() => metaManager.unlockArchetype("heavy", 50)).toThrow(
      /Insufficient intel/,
    );
  });

  it("should allow spending intel to unlock items", () => {
    metaManager.recordMissionResult({ kills: 0, casualties: 0, won: true, scrapGained: 0, intelGained: 100 });

    metaManager.unlockItem("autocannon", 75);

    const stats = metaManager.getStats();
    expect(stats.currentIntel).toBe(25);
    expect(stats.unlockedItems).toContain("autocannon");
    expect(metaManager.isItemUnlocked("autocannon")).toBe(true);
  });

  it("should persist unlocks across instances", () => {
    metaManager.recordMissionResult({ kills: 0, casualties: 0, won: true, scrapGained: 0, intelGained: 100 });
    metaManager.unlockArchetype("heavy", 50);

    
    const newMetaManager = new MetaManager(storage);

    expect(newMetaManager.getStats().unlockedArchetypes).toContain("heavy");
    expect(newMetaManager.getStats().currentIntel).toBe(50);
  });
});

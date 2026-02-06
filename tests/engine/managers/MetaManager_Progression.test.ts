import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetaManager } from "@src/engine/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("MetaManager Progression", () => {
  let storage: MockStorageProvider;
  let metaManager: MetaManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    MetaManager.resetInstance();
    metaManager = MetaManager.getInstance(storage);
  });

  it("should initialize with default values", () => {
    const stats = metaManager.getStats();
    expect(stats.currentIntel).toBe(0);
    expect(stats.unlockedArchetypes).toEqual([]);
    expect(stats.unlockedItems).toEqual([]);
  });

  it("should record intel gained from missions", () => {
    metaManager.recordMissionResult(10, 0, true, 100, 50);
    expect(metaManager.getStats().currentIntel).toBe(50);
  });

  it("should allow spending intel to unlock archetypes", () => {
    metaManager.recordMissionResult(0, 0, true, 0, 100);
    
    metaManager.unlockArchetype("heavy", 50);
    
    const stats = metaManager.getStats();
    expect(stats.currentIntel).toBe(50);
    expect(stats.unlockedArchetypes).toContain("heavy");
    expect(metaManager.isArchetypeUnlocked("heavy")).toBe(true);
  });

  it("should throw error if insufficient intel to unlock archetype", () => {
    expect(() => metaManager.unlockArchetype("heavy", 50)).toThrow(/Insufficient intel/);
  });

  it("should allow spending intel to unlock items", () => {
    metaManager.recordMissionResult(0, 0, true, 0, 100);
    
    metaManager.unlockItem("autocannon", 75);
    
    const stats = metaManager.getStats();
    expect(stats.currentIntel).toBe(25);
    expect(stats.unlockedItems).toContain("autocannon");
    expect(metaManager.isItemUnlocked("autocannon")).toBe(true);
  });

  it("should persist unlocks across instances", () => {
    metaManager.recordMissionResult(0, 0, true, 0, 100);
    metaManager.unlockArchetype("heavy", 50);
    
    MetaManager.resetInstance();
    const newMetaManager = MetaManager.getInstance(storage);
    
    expect(newMetaManager.getStats().unlockedArchetypes).toContain("heavy");
    expect(newMetaManager.getStats().currentIntel).toBe(50);
  });
});
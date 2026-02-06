import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/campaign/CampaignManager";
import { MetaManager } from "@src/engine/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

describe("CampaignManager Unlocks", () => {
  let storage: MockStorageProvider;
  let campaignManager: CampaignManager;
  let metaManager: MetaManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    MetaManager.resetInstance();
    campaignManager = CampaignManager.getInstance(storage);
    metaManager = MetaManager.getInstance(storage);
  });

  it("should initialize new campaign with global unlocked archetypes", () => {
    // 1. Unlock something globally
    metaManager.recordMissionResult(0, 0, true, 0, 100);
    metaManager.unlockArchetype("heavy", 50); // heavy might be default, but let's try another one if it's not
    metaManager.unlockArchetype("sniper", 50);
    
    // 2. Start new campaign
    campaignManager.startNewCampaign(12345, "Clone");
    
    const state = campaignManager.getState();
    expect(state).not.toBeNull();
    if (state) {
      expect(state.unlockedArchetypes).toContain("sniper");
      // Should also contain defaults
      CAMPAIGN_DEFAULTS.UNLOCKED_ARCHETYPES.forEach(arch => {
        expect(state.unlockedArchetypes).toContain(arch);
      });
    }
  });

  it("should initialize new campaign with global unlocked items", () => {
    // 1. Unlock something globally
    metaManager.recordMissionResult(0, 0, true, 0, 100);
    metaManager.unlockItem("autocannon", 50);
    
    // 2. Start new campaign
    campaignManager.startNewCampaign(12345, "Clone");
    
    const state = campaignManager.getState();
    expect(state).not.toBeNull();
    if (state) {
      expect(state.unlockedItems).toContain("autocannon");
    }
  });

  it("should record intel in MetaManager when mission completed", () => {
    campaignManager.startNewCampaign(12345, "Clone");
    const state = campaignManager.getState()!;
    const nodeId = state.nodes[0].id;
    
    campaignManager.processMissionResult({
      nodeId,
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 50,
      timeSpent: 1000,
      soldierResults: []
    });
    
    expect(metaManager.getStats().currentIntel).toBe(50);
  });

  it("should record intel in MetaManager when advancing without mission", () => {
    campaignManager.startNewCampaign(12345, "Clone");
    const state = campaignManager.getState()!;
    const nodeId = state.nodes[0].id;
    
    campaignManager.advanceCampaignWithoutMission(nodeId, 0, 75);
    
    expect(metaManager.getStats().currentIntel).toBe(75);
  });

  it("should prevent recruiting locked archetypes", () => {
    campaignManager.startNewCampaign(12345, "Clone");
    const state = campaignManager.getState()!;
    state.scrap = 1000;
    
    // 'sniper' is NOT in DEFAULT_ARCHETYPES and NOT unlocked in MetaManager before start
    expect(() => campaignManager.recruitSoldier("sniper")).toThrow(/not unlocked/);
  });

  it("should allow recruiting unlocked archetypes", () => {
    // 1. Unlock globally
    metaManager.recordMissionResult(0, 0, true, 0, 100);
    metaManager.unlockArchetype("heavy", 50);
    
    // 2. Start campaign
    campaignManager.startNewCampaign(12345, "Clone");
    const state = campaignManager.getState()!;
    state.scrap = 1000;
    
    // 3. Recruit
    const id = campaignManager.recruitSoldier("heavy");
    expect(id).toBeDefined();
    expect(state.roster.some(s => s.id === id)).toBe(true);
  });
});
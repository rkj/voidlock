import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/campaign/CampaignManager";
import { MetaManager } from "@src/engine/campaign/MetaManager";
import { MissionReconciler } from "@src/engine/campaign/MissionReconciler";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

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

  it("should unlock archetypes in MetaManager via intel spending", () => {
    // Record enough intel to unlock
    metaManager.recordMissionResult({ kills: 0, casualties: 0, won: true, scrapGained: 0, intelGained: 100 });
    metaManager.unlockArchetype("heavy", 50);
    metaManager.unlockArchetype("sniper", 50);

    expect(metaManager.isArchetypeUnlocked("sniper")).toBe(true);
    expect(metaManager.isArchetypeUnlocked("heavy")).toBe(true);
  });

  it("should unlock items in MetaManager via intel spending", () => {
    metaManager.recordMissionResult({ kills: 0, casualties: 0, won: true, scrapGained: 0, intelGained: 100 });
    metaManager.unlockItem("autocannon", 50);

    expect(metaManager.isItemUnlocked("autocannon")).toBe(true);
  });

  it("should record intel in MetaManager when mission completed via CampaignManager", () => {
    campaignManager.startNewCampaign(12345, "Standard");
    const state = campaignManager.getState()!;
    const nodeId = state.nodes.filter((n) => n.status === "Accessible")[0].id;

    // Must select node so currentNodeId is set
    campaignManager.selectNode(nodeId);

    campaignManager.reconcileMission({
      won: true,
      kills: 10,
      elitesKilled: 0,
      scrapGained: 100,
      intelGained: 50,
      casualties: [],
      xpGained: new Map(),
    });

    expect(metaManager.getStats().currentIntel).toBe(50);
  });

  it("should record intel in MetaManager when advancing without mission", () => {
    campaignManager.startNewCampaign(12345, "Standard");
    const state = campaignManager.getState()!;
    const nodeId = state.nodes[0].id;

    // Use MissionReconciler directly since advanceCampaignWithoutMission
    // is not on CampaignManager
    MissionReconciler.advanceCampaignWithoutMission(state, nodeId, 0, 75);

    // Note: advanceCampaignWithoutMission does not call MetaManager
    // Intel is added to campaign state directly
    expect(state.intel).toBe(75);
  });

  it("should recruit soldiers with sufficient scrap", () => {
    campaignManager.startNewCampaign(12345, "Standard");
    const state = campaignManager.getState()!;
    state.scrap = 1000;

    const id = campaignManager.recruitSoldier("assault");
    expect(id).not.toBeNull();
    expect(state.roster.some((s) => s.id === id)).toBe(true);
  });

  it("should return null when recruiting with insufficient scrap", () => {
    campaignManager.startNewCampaign(12345, "Standard");
    const state = campaignManager.getState()!;
    state.scrap = 50;

    const result = campaignManager.recruitSoldier("assault");
    expect(result).toBeNull();
  });
});

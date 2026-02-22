import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignManager } from "../../../src/engine/campaign/CampaignManager";
import { MetaManager } from "../../../src/engine/campaign/MetaManager";
import { MockStorageProvider } from "../../../src/engine/persistence/MockStorageProvider";
import { MissionType } from "../../../src/shared/types";

describe("CampaignManager Prologue Integration", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;
  let metaManager: MetaManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    MetaManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
    metaManager = MetaManager.getInstance(storage);
  });

  it("should set skipPrologue based on MetaStats.prologueCompleted", () => {
    // 1. Initially false
    manager.startNewCampaign(12345, "Clone");
    let state = manager.getState();
    expect(state?.rules.skipPrologue).toBe(false);
    expect(state?.nodes[0].missionType).toBe(MissionType.Prologue);

    // 2. Mark completed
    metaManager.recordPrologueCompleted();
    
    // 3. New campaign should default to true
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
    manager.startNewCampaign(67890, "Clone");
    state = manager.getState();
    expect(state?.rules.skipPrologue).toBe(true);
    expect(state?.nodes[0].missionType).not.toBe(MissionType.Prologue);
  });

  it("should allow overriding skipPrologue even if metaStats is true", () => {
    metaManager.recordPrologueCompleted();
    
    manager.startNewCampaign(12345, "Clone", { skipPrologue: false });
    const state = manager.getState();
    expect(state?.rules.skipPrologue).toBe(false);
    expect(state?.nodes[0].missionType).toBe(MissionType.Prologue);
  });

  it("should record prologue completed in metaStats on mission win", () => {
    manager.startNewCampaign(12345, "Clone", { skipPrologue: false });
    const state = manager.getState();
    const prologueNode = state?.nodes[0]!;
    
    manager.processMissionResult({
      nodeId: prologueNode.id,
      seed: prologueNode.mapSeed,
      result: "Won",
      aliensKilled: 1,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 100,
      soldierResults: []
    });

    expect(metaManager.getStats().prologueCompleted).toBe(true);
  });
});

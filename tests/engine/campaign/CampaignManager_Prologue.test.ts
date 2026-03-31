import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "../../../src/engine/persistence/MockStorageProvider";

describe("CampaignManager Prologue Integration", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;
  let metaManager: MetaManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    metaManager = new MetaManager(storage);
    manager = new CampaignManager(storage, metaManager);
  });

  it("should set skipPrologue based on MetaStats.prologueCompleted", () => {
    // 1. Initially false
    manager.startNewCampaign(12345, "Standard");
    let state = manager.getState();
    expect(state?.rules.skipPrologue).toBe(false);

    // 2. Mark completed
    metaManager.recordPrologueCompleted();

    // 3. New campaign should default to true
    manager = new CampaignManager(storage, metaManager);
    manager.startNewCampaign(67890, "Standard");
    state = manager.getState();
    expect(state?.rules.skipPrologue).toBe(true);
  });

  it("should allow overriding skipPrologue even if metaStats is true", () => {
    metaManager.recordPrologueCompleted();

    manager.startNewCampaign(12345, "Standard", { skipPrologue: false });
    const state = manager.getState();
    expect(state?.rules.skipPrologue).toBe(false);
  });

  it("should record mission result in metaStats on mission win", () => {
    manager.startNewCampaign(12345, "Standard", { skipPrologue: false });
    const state = manager.getState();
    const firstNode = state?.nodes[0]!;

    // Select the node first so reconcileMission doesn't bail
    manager.selectNode(firstNode.id);

    manager.reconcileMission({
      nodeId: firstNode.id,
      seed: firstNode.mapSeed,
      result: "Won",
      won: true,
      aliensKilled: 1,
      kills: 1,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 100,
      soldierResults: [],
      casualties: [],
    } as any);

    // Verify meta stats are updated
    expect(metaManager.getStats().totalMissionsPlayed).toBeGreaterThanOrEqual(1);
    expect(metaManager.getStats().totalMissionsWon).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Campaign Victory Trigger (voidlock-iq1b)", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should set campaign status to 'Victory' when a Boss node mission is won", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    
    // Find a boss node
    const bossNode = state.nodes.find(n => n.type === "Boss");
    expect(bossNode).toBeDefined();
    
    const report: MissionReport = {
      nodeId: bossNode!.id,
      seed: 123,
      result: "Won",
      aliensKilled: 50,
      scrapGained: 500,
      intelGained: 20,
      timeSpent: 5000,
      soldierResults: [],
    };

    manager.processMissionResult(report);
    
    expect(state.status).toBe("Victory");
    
    // Verify it's saved
    const savedState = storage.load<any>("voidlock_campaign_v1");
    expect(savedState.status).toBe("Victory");
  });

  it("should NOT set campaign status to 'Victory' when a non-Boss node mission is won", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    
    // Find a non-boss node (e.g. Combat)
    const combatNode = state.nodes.find(n => n.type === "Combat");
    expect(combatNode).toBeDefined();
    
    const report: MissionReport = {
      nodeId: combatNode!.id,
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [],
    };

    manager.processMissionResult(report);
    
    expect(state.status).toBe("Active");
  });

  it("should NOT set campaign status to 'Victory' when a Boss node mission is LOST", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    
    // Find a boss node
    const bossNode = state.nodes.find(n => n.type === "Boss");
    expect(bossNode).toBeDefined();
    
    const report: MissionReport = {
      nodeId: bossNode!.id,
      seed: 123,
      result: "Lost",
      aliensKilled: 5,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 5000,
      soldierResults: [],
    };

    manager.processMissionResult(report);
    
    expect(state.status).not.toBe("Victory");
  });
});

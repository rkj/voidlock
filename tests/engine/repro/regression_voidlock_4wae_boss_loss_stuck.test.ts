import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Regression: voidlock-4wae - Campaign Lost Screen Not Appearing", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should mark campaign as Defeat when Boss mission is lost (even in non-Ironman)", () => {
    manager.startNewCampaign(12345, "Normal"); // Clone mode, status: Active
    const state = manager.getState()!;
    
    // Find the boss node
    let bossNode = state.nodes.find((n) => n.type === "Boss");
    if (!bossNode) {
      // Force last node to be boss
      const maxRank = Math.max(...state.nodes.map(n => n.rank));
      bossNode = state.nodes.find(n => n.rank === maxRank)!;
      bossNode.type = "Boss";
    }

    const report: MissionReport = {
      nodeId: bossNode.id,
      seed: 123,
      result: "Lost",
      aliensKilled: 10,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 1000,
      soldierResults: [],
    };

    manager.processMissionResult(report);
    
    // Expect Defeat because it was the final mission and we lost
    expect(manager.getState()?.status).toBe("Defeat");
  });

  it("should mark campaign as Defeat when roster is empty (all dead or wounded) and cannot afford recruitment", () => {
    manager.startNewCampaign(12345, "Normal"); // Clone mode, starting scrap: 500
    const state = manager.getState()!;
    
    // Set all soldiers to Wounded and scrap to 0
    state.roster.forEach(s => {
      s.status = "Wounded";
      s.recoveryTime = 2;
    });
    state.scrap = 0;

    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

    const report: MissionReport = {
      nodeId: targetNodeId,
      seed: 123,
      result: "Lost", // Doesn't really matter for this test
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };

    // Trigger reconciliation
    manager.processMissionResult(report);

    // Expect Defeat because we have no healthy soldiers and no money to recruit
    expect(manager.getState()?.status).toBe("Defeat");
  });
});

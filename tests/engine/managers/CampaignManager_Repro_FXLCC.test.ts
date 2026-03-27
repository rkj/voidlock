import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Regression voidlock-fxlcc", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("reconcileMission should update state even if currentNodeId is null but result.nodeId is present", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

    // EXPLICITLY DO NOT CALL manager.selectNode(targetNodeId);
    // This simulates the bug where NavigationOrchestrator forgets to call selectNode.
    expect(state.currentNodeId).toBeNull();

    const report: MissionReport = {
      nodeId: targetNodeId,
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [],
    };

    manager.reconcileMission(report);
    
    // Now it should succeed because reconcileMission uses report.nodeId as fallback
    const node = state.nodes.find((n) => n.id === targetNodeId);
    expect(node?.status).toBe("Cleared"); 
    expect(state.scrap).toBe(700); // Scrap gained (600 + 100)
    expect(state.history.length).toBe(1); // History recorded
    expect(state.currentNodeId).toBe(targetNodeId); // Should have been set by the fallback
  });
});

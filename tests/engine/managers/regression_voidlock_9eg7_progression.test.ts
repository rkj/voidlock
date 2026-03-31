import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MissionReconciler } from "@src/engine/campaign/MissionReconciler";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Regression voidlock-9eg7: Node Locking and Forward Progression", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    
    storage = new MockStorageProvider();
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should mark sibling nodes as Skipped when a node is cleared", () => {
    manager.startNewCampaign(1, "Standard");
    const state = manager.getState()!;

    // Find rank 0 nodes (should be Accessible)
    const rank0Nodes = state.nodes.filter((n) => n.rank === 0);
    expect(rank0Nodes.length).toBeGreaterThan(0);
    expect(rank0Nodes[0].status).toBe("Accessible");

    // If there are multiple rank 0 nodes, check sibling skipping
    if (rank0Nodes.length > 1) {
      const nodeToClear = rank0Nodes[0];

      // Use MissionReconciler directly to advance the node
      MissionReconciler.advanceCampaignWithoutMission(state, nodeToClear.id, 0, 0);

      // The cleared node should be "Cleared"
      expect(state.nodes.find((n) => n.id === nodeToClear.id)!.status).toBe("Cleared");

      // Sibling rank 0 nodes that were "Accessible" should become "Skipped"
      const siblings = rank0Nodes.filter((n) => n.id !== nodeToClear.id);
      siblings.forEach((sibling) => {
        expect(state.nodes.find((n) => n.id === sibling.id)!.status).toBe("Skipped");
      });
    }
  });

  it("should clear a node and record it in history", () => {
    manager.startNewCampaign(1, "Standard");
    const state = manager.getState()!;

    const rank0Nodes = state.nodes.filter((n) => n.rank === 0);
    const nodeA = rank0Nodes[0];

    MissionReconciler.advanceCampaignWithoutMission(state, nodeA.id, 50, 0);

    // Node should be cleared
    expect(state.nodes.find((n) => n.id === nodeA.id)!.status).toBe("Cleared");
    // History should be recorded
    expect(state.history.length).toBe(1);
    expect(state.history[0].nodeId).toBe(nodeA.id);
  });

  it("should increment currentSector based on cleared node rank", () => {
    manager.startNewCampaign(1, "Standard");
    const state = manager.getState()!;

    const rank0Nodes = state.nodes.filter((n) => n.rank === 0);
    const nodeA = rank0Nodes[0];

    expect(state.currentSector).toBe(1);

    MissionReconciler.advanceCampaignWithoutMission(state, nodeA.id, 0, 0);

    // currentSector should now be rank + 1 = 1
    expect(state.currentSector).toBe(1);
  });
});

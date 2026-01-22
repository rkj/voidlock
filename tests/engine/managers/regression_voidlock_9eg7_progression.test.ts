import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Regression voidlock-9eg7: Node Locking and Forward Progression", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should mark sibling nodes as Skipped when a node is cleared", () => {
    manager.startNewCampaign(1, "Normal");
    const state = manager.getState()!;

    // Clear rank 0 node first to make rank 1 nodes Accessible
    const rank0Node = state.nodes.find((n) => n.rank === 0)!;
    manager.processMissionResult({
      nodeId: rank0Node.id,
      seed: 123,
      result: "Won",
      aliensKilled: 5,
      scrapGained: 50,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [],
    });

    // Find all rank 1 nodes. They should all be Accessible now.
    const rank1Nodes = state.nodes.filter((n) => n.rank === 1);
    expect(rank1Nodes.length).toBeGreaterThan(1); // PRNG seed 1 should give > 1 nodes
    rank1Nodes.forEach((n) => expect(n.status).toBe("Accessible"));

    const nodeToClear = rank1Nodes[0];
    const siblingNodes = rank1Nodes.slice(1);

    const report: MissionReport = {
      nodeId: nodeToClear.id,
      seed: 123,
      result: "Won",
      aliensKilled: 5,
      scrapGained: 50,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [],
    };

    manager.processMissionResult(report);

    // After clearing, nodeToClear should be Cleared
    expect(state.nodes.find((n) => n.id === nodeToClear.id)!.status).toBe(
      "Cleared",
    );

    // Sibling nodes should be Skipped
    siblingNodes.forEach((sibling) => {
      const updatedSibling = state.nodes.find((n) => n.id === sibling.id)!;
      expect(updatedSibling.status).toBe("Skipped");
    });
  });

  it("should only make connected nodes Accessible", () => {
    manager.startNewCampaign(1, "Normal");
    const state = manager.getState()!;

    const rank0Nodes = state.nodes.filter((n) => n.rank === 0);
    const nodeA = rank0Nodes[0];

    // Find a node at rank 1 that is NOT connected to nodeA
    const rank1Nodes = state.nodes.filter((n) => n.rank === 1);
    const notConnectedToA = rank1Nodes.find(
      (n1) => !nodeA.connections.includes(n1.id),
    );

    // Note: It's possible for all rank 1 nodes to be connected to nodeA if there are few nodes.
    // If that happens, this test part might be trivial.

    const report: MissionReport = {
      nodeId: nodeA.id,
      seed: 123,
      result: "Won",
      aliensKilled: 5,
      scrapGained: 50,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [],
    };

    manager.processMissionResult(report);

    // Connected nodes should be Accessible
    nodeA.connections.forEach((connId) => {
      expect(state.nodes.find((n) => n.id === connId)!.status).toBe(
        "Accessible",
      );
    });

    // Non-connected nodes at rank 1 should NOT be Accessible
    if (notConnectedToA) {
      expect(
        state.nodes.find((n) => n.id === notConnectedToA.id)!.status,
      ).not.toBe("Accessible");
    }
  });

  it("should increment currentSector based on cleared node rank", () => {
    manager.startNewCampaign(1, "Normal");
    const state = manager.getState()!;

    const rank0Nodes = state.nodes.filter((n) => n.rank === 0);
    const nodeA = rank0Nodes[0];

    expect(state.currentSector).toBe(1);

    const report: MissionReport = {
      nodeId: nodeA.id,
      seed: 123,
      result: "Won",
      aliensKilled: 5,
      scrapGained: 50,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [],
    };

    manager.processMissionResult(report);

    // currentSector should now be rank + 2 = 2
    expect(state.currentSector).toBe(2);
  });
});

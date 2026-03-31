import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Campaign Progression Integration Tests", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    
    storage = new MockStorageProvider();
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should unlock connected nodes when a node is cleared", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    
    // Rank 0 node
    const node0 = state.nodes.find(n => n.rank === 0)!;
    expect(node0.status).toBe("Accessible");

    // Connected nodes at rank 1
    const connectedNodeIds = node0.connections;
    expect(connectedNodeIds.length).toBeGreaterThan(0);

    connectedNodeIds.forEach(id => {
      const node1 = state.nodes.find(n => n.id === id)!;
      expect(node1.status).toBe("Hidden");
    });

    // Reconcile node 0
    manager.selectNode(node0.id);
    const report: MissionReport = {
      nodeId: node0.id,
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [],
    };
    manager.reconcileMission(report);

    // Node 0 should be cleared
    expect(node0.status).toBe("Cleared");

    // Connected nodes should now be Accessible
    connectedNodeIds.forEach(id => {
      const node1 = state.nodes.find(n => n.id === id)!;
      expect(node1.status).toBe("Accessible");
    });

    // Other nodes at rank 1 (if any) not connected to node 0 should NOT be Accessible
    const otherRank1Nodes = state.nodes.filter(n => n.rank === 1 && !connectedNodeIds.includes(n.id));
    otherRank1Nodes.forEach(n => {
       // Note: they might have been made Accessible if they were also connected to another node0, 
       // but since we only have one node at rank 0, this is guaranteed.
       expect(n.status).toBe("Hidden");
    });
  });

  it("should skip nodes that were Accessible but not selected", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    
    // Force multiple nodes at rank 0 for testing (though normally there's only one)
    // Actually, let's use a more realistic scenario: Rank 1 nodes after clearing Rank 0.
    const node0 = state.nodes.find(n => n.rank === 0)!;
    manager.selectNode(node0.id);
    manager.reconcileMission({
      nodeId: node0.id,
      won: true,
      kills: 0,
      elitesKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      casualties: [],
      xpGained: new Map()
    });

    const rank1Nodes = state.nodes.filter(n => n.rank === 1 && n.status === "Accessible");
    expect(rank1Nodes.length).toBeGreaterThan(1); // Usually 4 lanes

    const selectedNode = rank1Nodes[0];
    const skippedNode = rank1Nodes[1];

    manager.selectNode(selectedNode.id);
    manager.reconcileMission({
      nodeId: selectedNode.id,
      won: true,
      kills: 0,
      elitesKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      casualties: [],
      xpGained: new Map()
    });

    expect(selectedNode.status).toBe("Cleared");
    expect(skippedNode.status).toBe("Skipped");
  });
});

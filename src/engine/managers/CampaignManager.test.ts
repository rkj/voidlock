import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "./CampaignManager";
import { MissionReport } from "../../shared/campaign_types";
import { MockStorageProvider } from "../persistence/MockStorageProvider";

describe("CampaignManager", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should start a new campaign with correct initial state", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState();

    expect(state).not.toBeNull();
    expect(state?.seed).toBe(12345);
    expect(state?.rules.deathRule).toBe("Clone");
    expect(state?.scrap).toBe(500);
    expect(state?.roster.length).toBe(4);
    expect(state?.nodes.length).toBeGreaterThan(0);
    expect(
      state?.nodes.filter((n) => n.status === "Accessible").length,
    ).toBeGreaterThan(0);
  });

  it("should save and load campaign state using StorageProvider", () => {
    manager.startNewCampaign(12345, "Normal");
    const originalState = JSON.parse(JSON.stringify(manager.getState()));

    // Create a new instance with the same storage
    CampaignManager.resetInstance();
    const newManager = CampaignManager.getInstance(storage);
    const success = newManager.load();

    expect(success).toBe(true);
    expect(newManager.getState()).toEqual(originalState);
  });

  it("should process mission results and update state", () => {
    manager.startNewCampaign(12345, "Normal");
    const availableNodes = manager.getAvailableNodes();
    const targetNodeId = availableNodes[0].id;

    const report: MissionReport = {
      nodeId: targetNodeId,
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [
        {
          soldierId: "soldier_0",
          xpGained: 50,
          kills: 3,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    manager.processMissionResult(report);
    const state = manager.getState();

    const node = state?.nodes.find((n) => n.id === targetNodeId);
    expect(node?.status).toBe("Cleared");
    expect(state?.scrap).toBe(600);
    expect(state?.intel).toBe(5);
    expect(state?.history.length).toBe(1);

    const soldier = state?.roster.find((s) => s.id === "soldier_0");
    expect(soldier?.xp).toBe(50);
    expect(soldier?.kills).toBe(3);
    expect(soldier?.missions).toBe(1);
  });

  it("should unlock next nodes after clearing a node", () => {
    manager.startNewCampaign(12345, "Normal");
    const startNode = manager.getAvailableNodes()[0];
    const nextNodeIds = startNode.connections;

    expect(nextNodeIds.length).toBeGreaterThan(0);

    const report: MissionReport = {
      nodeId: startNode.id,
      seed: 123,
      result: "Won",
      aliensKilled: 5,
      scrapGained: 50,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [],
    };

    manager.processMissionResult(report);

    nextNodeIds.forEach((id) => {
      const node = manager.getState()?.nodes.find((n) => n.id === id);
      expect(node?.status).toBe("Accessible");
    });
  });

  it("should support different difficulty levels", () => {
    manager.startNewCampaign(1, "Easy");
    expect(manager.getState()?.rules.deathRule).toBe("Simulation");

    manager.startNewCampaign(1, "Hard");
    expect(manager.getState()?.rules.deathRule).toBe("Iron");
  });

  it("should throw error if getInstance called without storage on first time", () => {
    CampaignManager.resetInstance();
    expect(() => CampaignManager.getInstance()).toThrow();
  });
});

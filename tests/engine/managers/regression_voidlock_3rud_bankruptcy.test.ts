import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Bankruptcy", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    
    storage = new MockStorageProvider();
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should NOT trigger bankruptcy if there are healthy soldiers", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    state.scrap = 50; // Less than 100

    const nodeId = state.nodes.filter((n) => n.status === "Accessible")[0].id;
    manager.selectNode(nodeId);

    const report: MissionReport = {
      nodeId,
      seed: 123,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [], // No soldiers died
    };

    manager.reconcileMission(report);
    expect(state.status).toBe("Active");
  });

  it("should trigger bankruptcy if there are only wounded soldiers and scrap < 100", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    state.scrap = 50;
    state.roster.forEach((s) => (s.status = "Wounded"));

    const nodeId = state.nodes.filter((n) => n.status === "Accessible")[0].id;
    manager.selectNode(nodeId);

    const report: MissionReport = {
      nodeId,
      seed: 123,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };

    manager.reconcileMission(report);
    expect(state.status).toBe("Defeat");
  });

  it("should trigger bankruptcy if all soldiers are dead AND scrap < 100", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    state.scrap = 50;

    // Mark all soldiers as dead in the state
    state.roster.forEach((s) => (s.status = "Dead"));

    const nodeId = state.nodes.filter((n) => n.status === "Accessible")[0].id;
    manager.selectNode(nodeId);

    const report: MissionReport = {
      nodeId,
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: state.roster.map((s) => ({
        soldierId: s.id,
        xpBefore: 0,
        xpGained: 0,
        kills: 0,
        promoted: false,
        status: "Dead",
      })),
    };

    manager.reconcileMission(report);
    expect(state.status).toBe("Defeat");
  });

  it("should NOT trigger bankruptcy if all soldiers are dead BUT scrap >= 100", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;
    state.scrap = 150;

    state.roster.forEach((s) => (s.status = "Dead"));

    const nodeId = state.nodes.filter((n) => n.status === "Accessible")[0].id;
    manager.selectNode(nodeId);

    const report: MissionReport = {
      nodeId,
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: state.roster.map((s) => ({
        soldierId: s.id,
        xpBefore: 0,
        xpGained: 0,
        kills: 0,
        promoted: false,
        status: "Dead",
      })),
    };

    manager.reconcileMission(report);
    expect(state.status).toBe("Active");
  });

  it("should trigger defeat on any mission loss for Ironman difficulty", () => {
    manager.startNewCampaign(12345, "Ironman");
    const state = manager.getState()!;
    state.scrap = 500;

    const nodeId = state.nodes.filter((n) => n.status === "Accessible")[0].id;
    manager.selectNode(nodeId);

    // Some soldiers die, but not all
    const report: MissionReport = {
      nodeId,
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [
        {
          soldierId: state.roster[0].id,
          xpBefore: 0,
          xpGained: 0,
          kills: 0,
          promoted: false,
          status: "Dead",
        },
      ],
    };

    manager.reconcileMission(report);
    // Ironman difficulty: any mission loss = Defeat
    expect(state.status).toBe("Defeat");
  });
});

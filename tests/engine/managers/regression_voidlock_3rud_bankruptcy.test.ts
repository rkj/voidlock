import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Bankruptcy", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should NOT trigger bankruptcy if there are healthy soldiers", () => {
    manager.startNewCampaign(12345, "Normal"); // scrap: 500
    const state = manager.getState()!;
    state.scrap = 50; // Less than 100

    const report: MissionReport = {
      nodeId: state.nodes.filter(n => n.status === "Accessible")[0].id,
      seed: 123,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [], // No soldiers died
    };

    manager.processMissionResult(report);
    expect(state.status).toBe("Active");
  });

  it("should NOT trigger bankruptcy if there are wounded soldiers even if scrap < 100", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    state.scrap = 50;
    state.roster.forEach(s => s.status = "Wounded");

    const report: MissionReport = {
      nodeId: state.nodes.filter(n => n.status === "Accessible")[0].id,
      seed: 123,
      result: "Won",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };

    manager.processMissionResult(report);
    expect(state.status).toBe("Active");
  });

  it("should trigger bankruptcy if all soldiers are dead AND scrap < 100", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    state.scrap = 50;
    
    // Mark all soldiers as dead in the state
    state.roster.forEach(s => s.status = "Dead");

    const report: MissionReport = {
      nodeId: state.nodes.filter(n => n.status === "Accessible")[0].id,
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: state.roster.map(s => ({
        soldierId: s.id,
        xpBefore: 0,
        xpGained: 0,
        kills: 0,
        promoted: false,
        status: "Dead",
      })),
    };

    manager.processMissionResult(report);
    expect(state.status).toBe("Defeat");
  });

  it("should NOT trigger bankruptcy if all soldiers are dead BUT scrap >= 100", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    state.scrap = 150;
    
    state.roster.forEach(s => s.status = "Dead");

    const report: MissionReport = {
      nodeId: state.nodes.filter(n => n.status === "Accessible")[0].id,
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: state.roster.map(s => ({
        soldierId: s.id,
        xpBefore: 0,
        xpGained: 0,
        kills: 0,
        promoted: false,
        status: "Dead",
      })),
    };

    manager.processMissionResult(report);
    expect(state.status).toBe("Active");
  });

  it("should NOT trigger defeat on mission loss for Standard difficulty if not bankrupt", () => {
    manager.startNewCampaign(12345, "Hard"); // Hard/Standard has deathRule: "Iron"
    const state = manager.getState()!;
    state.scrap = 500;
    
    // Some soldiers die, but not all
    const report: MissionReport = {
      nodeId: state.nodes.filter(n => n.status === "Accessible")[0].id,
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
        }
      ],
    };

    manager.processMissionResult(report);
    expect(state.status).toBe("Active");
  });
});

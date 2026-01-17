import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "../../../src/engine/managers/CampaignManager";
import { MetaManager } from "../../../src/engine/managers/MetaManager";
import { MockStorageProvider } from "../../../src/engine/persistence/MockStorageProvider";
import { MissionReport } from "../../../src/shared/campaign_types";

describe("MetaManager", () => {
  let storage: MockStorageProvider;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    MetaManager.resetInstance();
  });

  it("tracks global stats across multiple campaigns", () => {
    const meta = MetaManager.getInstance(storage);
    const campaign = CampaignManager.getInstance(storage);

    // Start campaign 1
    campaign.startNewCampaign(123, "Simulation");
    expect(meta.getStats().totalCampaignsStarted).toBe(1);

    // Simulate a mission win
    const report1: MissionReport = {
      nodeId: "node_0_0",
      seed: 123,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 10,
      timeSpent: 1000,
      soldierResults: [
        { soldierId: "soldier_0", xpBefore: 0, xpGained: 0, kills: 5, promoted: false, status: "Healthy" },
        { soldierId: "soldier_1", xpBefore: 0, xpGained: 0, kills: 5, promoted: false, status: "Healthy" },
      ],
    };
    campaign.processMissionResult(report1);

    expect(meta.getStats().totalKills).toBe(10);
    expect(meta.getStats().totalMissionsPlayed).toBe(1);
    expect(meta.getStats().totalMissionsWon).toBe(1);
    expect(meta.getStats().totalScrapEarned).toBe(100);
    expect(meta.getStats().totalCasualties).toBe(0);

    // Start campaign 2
    campaign.reset();
    CampaignManager.resetInstance();
    const campaign2 = CampaignManager.getInstance(storage);
    campaign2.startNewCampaign(456, "Simulation");
    expect(meta.getStats().totalCampaignsStarted).toBe(2);

    // Simulate a mission loss with casualties
    const report2: MissionReport = {
      nodeId: "node_0_0",
      seed: 456,
      result: "Lost",
      aliensKilled: 5,
      scrapGained: 20,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [
        { soldierId: "soldier_0", xpBefore: 0, xpGained: 0, kills: 2, promoted: false, status: "Dead" },
        { soldierId: "soldier_1", xpBefore: 0, xpGained: 0, kills: 3, promoted: false, status: "Healthy" },
      ],
    };
    campaign2.processMissionResult(report2);

    expect(meta.getStats().totalKills).toBe(15);
    expect(meta.getStats().totalMissionsPlayed).toBe(2);
    expect(meta.getStats().totalMissionsWon).toBe(1);
    expect(meta.getStats().totalScrapEarned).toBe(120);
    expect(meta.getStats().totalCasualties).toBe(1);

    // Advance without mission (e.g. Shop)
    campaign2.advanceCampaignWithoutMission("node_shop", 50, 0);
    expect(meta.getStats().totalMissionsPlayed).toBe(3);
    expect(meta.getStats().totalScrapEarned).toBe(170);
  });

  it("records campaign victory", () => {
    const meta = MetaManager.getInstance(storage);
    const campaign = CampaignManager.getInstance(storage);

    campaign.startNewCampaign(123, "Simulation");
    
    // Manually set a node to Boss and clear it
    const state = campaign.getState();
    if (state) {
      const bossNode = state.nodes.find(n => n.type === "Boss");
      if (bossNode) {
        bossNode.status = "Accessible";
        const report: MissionReport = {
          nodeId: bossNode.id,
          seed: 123,
          result: "Won",
          aliensKilled: 20,
          scrapGained: 500,
          intelGained: 50,
          timeSpent: 2000,
          soldierResults: [],
        };
        campaign.processMissionResult(report);
      }
    }

    expect(meta.getStats().campaignsWon).toBe(1);
    expect(meta.getStats().campaignsLost).toBe(0);
  });

  it("records campaign defeat (Ironman)", () => {
    const meta = MetaManager.getInstance(storage);
    const campaign = CampaignManager.getInstance(storage);

    campaign.startNewCampaign(123, "Ironman");
    
    const report: MissionReport = {
      nodeId: "node_0_0",
      seed: 123,
      result: "Lost",
      aliensKilled: 0,
      scrapGained: 0,
      intelGained: 0,
      timeSpent: 100,
      soldierResults: [],
    };
    campaign.processMissionResult(report);

    expect(meta.getStats().campaignsWon).toBe(0);
    expect(meta.getStats().campaignsLost).toBe(1);
  });

  it("records campaign defeat (Bankruptcy)", () => {
    const meta = MetaManager.getInstance(storage);
    const campaign = CampaignManager.getInstance(storage);

    campaign.startNewCampaign(123, "Standard");
    
    // Kill all soldiers and spend all scrap
    const state = campaign.getState();
    if (state) {
        state.scrap = 0;
        const report: MissionReport = {
            nodeId: "node_0_0",
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
                status: "Dead"
            })),
        };
        campaign.processMissionResult(report);
    }

    expect(meta.getStats().campaignsWon).toBe(0);
    expect(meta.getStats().campaignsLost).toBe(1);
  });
});

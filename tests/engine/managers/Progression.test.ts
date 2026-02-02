import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport, STAT_BOOSTS } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("Campaign Progression (XP and Leveling)", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should handle leveling up and applying stat boosts", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    const soldier = state.roster[0];
    const initialMaxHp = soldier.maxHp;
    const initialAim = soldier.soldierAim;

    // Level 1 -> 2 (Threshold 100)
    const report1: MissionReport = {
      nodeId: state.nodes.filter((n) => n.status === "Accessible")[0].id,
      seed: 1,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [
        {
          soldierId: soldier.id,
          xpBefore: 0,
          xpGained: 120, // Enough for Level 2
          kills: 5,
          promoted: false, // CampaignManager should update this
          status: "Healthy",
        },
      ],
    };

    manager.processMissionResult(report1);

    const updatedSoldier = manager.getState()!.roster[0];
    expect(updatedSoldier.level).toBe(2);
    // XP calculation: 50 (Won) + 20 (Healthy) + 5 * 10 (Kills) = 120
    expect(updatedSoldier.xp).toBe(120);
    expect(report1.soldierResults[0].xpGained).toBe(120);
    expect(updatedSoldier.maxHp).toBe(initialMaxHp + STAT_BOOSTS.hpPerLevel);
    expect(updatedSoldier.hp).toBe(initialMaxHp + STAT_BOOSTS.hpPerLevel);
    expect(updatedSoldier.soldierAim).toBe(
      initialAim + STAT_BOOSTS.aimPerLevel,
    );

    // Check if report was updated
    expect(report1.soldierResults[0].promoted).toBe(true);
    expect(report1.soldierResults[0].newLevel).toBe(2);
  });

  it("should calculate XP correctly for a lost mission with casualties", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    const soldier = state.roster[0];

    // Lost: 10, Dead: 0, Kills: 2 * 10 = 20. Total: 30 (OLD RULES).
    // NEW RULES: Dead = 0 XP (spec/campaign.md#3.3).
    const report: MissionReport = {
      nodeId: state.nodes.filter((n) => n.status === "Accessible")[0].id,
      seed: 1,
      result: "Lost",
      aliensKilled: 5,
      scrapGained: 20,
      intelGained: 0,
      timeSpent: 1000,
      soldierResults: [
        {
          soldierId: soldier.id,
          xpBefore: 0,
          xpGained: 0,
          kills: 2,
          promoted: false,
          status: "Dead",
        },
      ],
    };

    manager.processMissionResult(report);

    const updatedSoldier = manager.getState()!.roster[0];
    expect(updatedSoldier.xp).toBe(0);
    expect(report.soldierResults[0].xpGained).toBe(0);
  });

  it("should calculate XP correctly for a survivor in a lost mission", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    const soldier = state.roster[0];

    // Lost: 10, Wounded: 20, Kills: 0. Total: 30.
    const report: MissionReport = {
      nodeId: state.nodes.filter((n) => n.status === "Accessible")[0].id,
      seed: 1,
      result: "Lost",
      aliensKilled: 1,
      scrapGained: 10,
      intelGained: 0,
      timeSpent: 500,
      soldierResults: [
        {
          soldierId: soldier.id,
          xpBefore: 0,
          xpGained: 0,
          kills: 0,
          promoted: false,
          status: "Wounded",
        },
      ],
    };

    manager.processMissionResult(report);

    const updatedSoldier = manager.getState()!.roster[0];
    expect(updatedSoldier.xp).toBe(30);
  });

  it("should handle multi-level promotion in a single mission", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    const soldier = state.roster[0];
    const initialMaxHp = soldier.maxHp;

    // Jump to Level 3 (Threshold 250)
    // XP calculation: 50 (Won) + 20 (Healthy) + 20 * 10 (Kills) = 270
    const report: MissionReport = {
      nodeId: state.nodes.filter((n) => n.status === "Accessible")[0].id,
      seed: 1,
      result: "Won",
      aliensKilled: 20,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [
        {
          soldierId: soldier.id,
          xpBefore: 0,
          xpGained: 0,
          kills: 20,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    manager.processMissionResult(report);

    const updatedSoldier = manager.getState()!.roster[0];
    expect(updatedSoldier.level).toBe(3);
    expect(updatedSoldier.xp).toBe(270);
    expect(updatedSoldier.maxHp).toBe(
      initialMaxHp + STAT_BOOSTS.hpPerLevel * 2,
    );
  });
});

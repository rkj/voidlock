import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import {
  MissionReport,
  STAT_BOOSTS,
  XP_THRESHOLDS,
} from "@src/shared/campaign_types";
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
    expect(updatedSoldier.xp).toBe(120);
    expect(updatedSoldier.maxHp).toBe(initialMaxHp + STAT_BOOSTS.hpPerLevel);
    expect(updatedSoldier.hp).toBe(initialMaxHp + STAT_BOOSTS.hpPerLevel);
    expect(updatedSoldier.soldierAim).toBe(
      initialAim + STAT_BOOSTS.aimPerLevel,
    );

    // Check if report was updated
    expect(report1.soldierResults[0].promoted).toBe(true);
    expect(report1.soldierResults[0].newLevel).toBe(2);
  });

  it("should handle multi-level promotion in a single mission", () => {
    manager.startNewCampaign(12345, "Normal");
    const state = manager.getState()!;
    const soldier = state.roster[0];
    const initialMaxHp = soldier.maxHp;

    // Jump to Level 3 (Threshold 250)
    const report: MissionReport = {
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
          xpGained: 300,
          kills: 10,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    manager.processMissionResult(report);

    const updatedSoldier = manager.getState()!.roster[0];
    expect(updatedSoldier.level).toBe(3);
    expect(updatedSoldier.maxHp).toBe(
      initialMaxHp + STAT_BOOSTS.hpPerLevel * 2,
    );
  });
});

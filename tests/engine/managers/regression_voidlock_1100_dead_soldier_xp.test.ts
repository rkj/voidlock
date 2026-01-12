import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MissionReport } from "@src/shared/campaign_types";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Regression (voidlock-1100)", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("regression: dead soldiers should not receive XP", () => {
    // 1. Start a campaign in 'Hard' (Ironman) mode to ensure death is permanent/tracked.
    manager.startNewCampaign(12345, "Hard");
    const state = manager.getState();
    const soldier = state!.roster[0];

    // 2. Manually set a soldier's XP to 80 (Level 1).
    soldier.xp = 80;
    soldier.level = 1;

    // 3. Construct a MissionReport where this soldier has status: 'Dead' but has accumulated kills.
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
          soldierId: soldier.id,
          xpBefore: 80,
          xpGained: 999, // Should be overwritten by manager
          kills: 5,
          promoted: false,
          status: "Dead",
        },
      ],
    };

    // 4. Call processMissionResult.
    manager.processMissionResult(report);

    // 5. Assertions
    const updatedSoldier = state?.roster.find((s) => s.id === soldier.id);
    expect(updatedSoldier?.xp).toBe(80); // Should not have increased
    expect(updatedSoldier?.level).toBe(1); // Should not have leveled up
    expect(updatedSoldier?.status).toBe("Dead");

    const result = report.soldierResults[0];
    expect(result.xpGained).toBe(0);
    expect(result.promoted).toBe(false);
  });
});

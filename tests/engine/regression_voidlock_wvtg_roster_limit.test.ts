import { describe, it, expect, beforeEach } from "vitest";
import { RosterManager } from "@src/engine/campaign/RosterManager";
import { CampaignState } from "@src/shared/campaign_types";
import { CAMPAIGN_DEFAULTS } from "@src/engine/config/CampaignDefaults";

describe("RosterManager Regression: Roster Limit (voidlock-wvtg)", () => {
  let rosterManager: RosterManager;
  let state: CampaignState;

  beforeEach(() => {
    rosterManager = new RosterManager();
    state = {
      status: "Active",
      scrap: 2000,
      intel: 0,
      currentSector: 1,
      currentNodeId: "start",
      rules: {
        difficulty: "Standard",
        deathRule: "Permadeath",
        economyMode: "Open",
        allowTacticalPause: true,
      },
      unlockedArchetypes: ["assault", "medic", "scout"],
      unlockedItems: [],
      roster: [],
      nodes: [],
      missionHistory: [],
      statistics: {
        missionsCompleted: 0,
        enemiesKilled: 0,
        scrapEarned: 0,
        intelGained: 0,
        casualties: 0,
      },
    };
  });

  it("should allow recruitment up to MAX_ROSTER_SIZE", () => {
    // Recruit up to the limit
    for (let i = 0; i < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE; i++) {
      rosterManager.recruitSoldier(state, "assault");
    }
    expect(state.roster.length).toBe(CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE);

    // Try to recruit one more
    expect(() => rosterManager.recruitSoldier(state, "assault")).toThrow(
      `Roster is full (max ${CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE} soldiers).`,
    );
  });

  it("should not count dead soldiers differently for the limit", () => {
    // Fill roster with 11 healthy soldiers
    for (let i = 0; i < CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE - 1; i++) {
      rosterManager.recruitSoldier(state, "assault");
    }
    
    // Add one dead soldier
    state.roster.push({
      id: "dead-1",
      name: "Dead Guy",
      archetypeId: "assault",
      hp: 0,
      maxHp: 100,
      soldierAim: 80,
      xp: 0,
      level: 1,
      kills: 0,
      missions: 0,
      status: "Dead",
      recoveryTime: 0,
      equipment: {
        rightHand: "pistol",
      },
    });

    expect(state.roster.length).toBe(CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE);

    // Try to recruit one more
    expect(() => rosterManager.recruitSoldier(state, "assault")).toThrow(
      `Roster is full (max ${CAMPAIGN_DEFAULTS.MAX_ROSTER_SIZE} soldiers).`,
    );
  });
});

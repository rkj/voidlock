import { describe, it, expect } from "vitest";
import { CampaignStateSchema } from "@src/shared/schemas/campaign";

describe("CampaignStateSchema", () => {
  const validState = {
    version: "1.0",
    seed: 12345,
    status: "Active",
    rules: {
      mode: "Preset",
      difficulty: "Standard",
      deathRule: "Iron",
      allowTacticalPause: true,
      mapGeneratorType: "DenseShip",
      difficultyScaling: 1.0,
      resourceScarcity: 1.0,
      startingScrap: 500,
      mapGrowthRate: 1.0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1.0,
      economyMode: "Open",
    },
    scrap: 1000,
    intel: 50,
    currentSector: 1,
    currentNodeId: null,
    nodes: [],
    roster: [],
    history: [],
    unlockedArchetypes: ["assault", "medic"],
  };

  it("should validate a valid campaign state", () => {
    const result = CampaignStateSchema.safeParse(validState);
    if (!result.success) {
      console.log(result.error.format());
    }
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const invalidState = { ...validState, status: "InvalidStatus" };
    const result = CampaignStateSchema.safeParse(invalidState);
    expect(result.success).toBe(false);
  });

  it("should reject missing rules", () => {
    const { rules, ...invalidState } = validState as any;
    const result = CampaignStateSchema.safeParse(invalidState);
    expect(result.success).toBe(false);
  });

  it("should reject invalid difficulty", () => {
    const invalidState = {
      ...validState,
      rules: { ...validState.rules, difficulty: "Invalid" },
    };
    const result = CampaignStateSchema.safeParse(invalidState);
    expect(result.success).toBe(false);
  });
});

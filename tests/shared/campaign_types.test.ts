import { describe, it, expect } from "vitest";
import {
  CampaignState,
  GameRules,
  CampaignNode,
  CampaignSoldier,
  MissionReport,
} from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types";

describe("Campaign Types", () => {
  it("should allow creating a valid CampaignState object with all sub-types", () => {
    const rules: GameRules = {
      mode: "Preset",
      difficulty: "Standard",
      deathRule: "Iron",
      allowTacticalPause: true,
      mapGeneratorType: MapGeneratorType.DenseShip,
      difficultyScaling: 1.5,
      resourceScarcity: 0.7,
      startingScrap: 300,
      mapGrowthRate: 1.0,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1,
      economyMode: "Open",
    };

    const node: CampaignNode = {
      id: "node-1",
      type: "Combat",
      status: "Accessible",
      difficulty: 1,
      rank: 0,
      mapSeed: 12345,
      connections: ["node-2"],
      position: { x: 0, y: 0 },
      bonusLootCount: 1,
    };

    const soldier: CampaignSoldier = {
      id: "s1",
      name: "John Doe",
      archetypeId: "assault",
      hp: 100,
      maxHp: 100,
      soldierAim: 90,
      xp: 0,
      level: 1,
      kills: 0,
      missions: 0,
      status: "Healthy",
      equipment: {},
    };

    const report: MissionReport = {
      nodeId: "node-1",
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 50,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [
        {
          soldierId: "s1",
          xpBefore: 0,
          xpGained: 10,
          kills: 2,
          promoted: false,
          status: "Healthy",
        },
      ],
    };

    const state: CampaignState = {
      version: "0.1.0",
      seed: 42,
      status: "Active",
      rules,
      scrap: 100,
      intel: 0,
      currentSector: 1,
      currentNodeId: null,
      nodes: [node],
      roster: [soldier],
      history: [report],
      unlockedArchetypes: ["assault", "medic"],
    };

    expect(state.version).toBe("0.1.0");
    expect(state.nodes[0].type).toBe("Combat");
    expect(state.nodes[0].connections).toContain("node-2");
    expect(state.roster[0].name).toBe("John Doe");
    expect(state.history[0].result).toBe("Won");
    expect(state.history[0].soldierResults[0].xpGained).toBe(10);
    expect(state.unlockedArchetypes).toContain("assault");
  });
});

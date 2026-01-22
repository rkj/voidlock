import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { GameRules, MissionReport } from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types";

describe("Campaign Victory Logic", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
  });

  it("should assign Boss type to the last layer", () => {
    const generator = new SectorMapGenerator();
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
      baseEnemyCount: 4,
      enemyGrowthPerMission: 1.5,
      economyMode: "Open",
    };
    const nodes = generator.generate(12345, rules);

    const maxRank = Math.max(...nodes.map((n) => n.rank));
    const lastRankNodes = nodes.filter((n) => n.rank === maxRank);

    expect(lastRankNodes.length).toBe(1);
    expect(lastRankNodes[0].type).toBe("Boss");
  });

  it("should trigger victory when Boss node is won", () => {
    manager.startNewCampaign(12345, "standard");
    const state = manager.getState()!;

    const bossNode = state.nodes.find((n) => n.type === "Boss")!;
    expect(bossNode).toBeTruthy();

    const report: MissionReport = {
      nodeId: bossNode.id,
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: state.roster.map((s) => ({
        soldierId: s.id,
        xpBefore: 0,
        xpGained: 50,
        kills: 2,
        promoted: false,
        status: "Healthy",
      })),
    };

    manager.processMissionResult(report);

    expect(manager.getState()?.status).toBe("Victory");
  });

  it("should trigger victory in Extended campaign", () => {
    manager.startNewCampaign(12345, "standard", { mapGrowthRate: 0.5 });
    const state = manager.getState()!;

    // With 0.5 growthRate, defaultLayers should be 13
    const maxRank = Math.max(...state.nodes.map((n) => n.rank));
    expect(maxRank).toBe(12); // Ranks 0 to 12

    const bossNode = state.nodes.find((n) => n.rank === maxRank)!;
    expect(bossNode.type).toBe("Boss");

    const report: MissionReport = {
      nodeId: bossNode.id,
      seed: 12345,
      result: "Won",
      aliensKilled: 10,
      scrapGained: 100,
      intelGained: 5,
      timeSpent: 1000,
      soldierResults: [],
    };

    manager.processMissionResult(report);
    expect(manager.getState()?.status).toBe("Victory");
  });
});

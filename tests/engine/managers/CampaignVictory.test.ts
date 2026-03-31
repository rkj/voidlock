import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/renderer/campaign/CampaignManager";
import { MetaManager } from "@src/renderer/campaign/MetaManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { MissionReport } from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types";

describe("Campaign Victory Logic", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;

  beforeEach(() => {
    storage = new MockStorageProvider();
    
    manager = new CampaignManager(storage, new MetaManager(new MockStorageProvider()));
  });

  it("should assign Boss type to the last layer", () => {
    const rules = {
      difficulty: "Standard",
      deathRule: "Clone",
      allowTacticalPause: true,
      mapGeneratorType: MapGeneratorType.DenseShip,
      difficultyScaling: 1.0,
      resourceScarcity: 1.0,
      startingScrap: 600,
      mapGrowthRate: 0.5,
      baseEnemyCount: 3,
      enemyGrowthPerMission: 1.0,
      economyMode: "Normal",
    };
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules });

    const maxRank = Math.max(...nodes.map((n) => n.rank));
    const lastRankNodes = nodes.filter((n) => n.rank === maxRank);

    expect(lastRankNodes.length).toBe(1);
    expect(lastRankNodes[0].type).toBe("Boss");
  });

  it("should trigger victory when Boss node is won", () => {
    manager.startNewCampaign(12345, "Standard");
    const state = manager.getState()!;

    const bossNode = state.nodes.find((n) => n.type === "Boss")!;
    expect(bossNode).toBeTruthy();

    // Must set currentNodeId for reconcileMission to proceed
    state.currentNodeId = bossNode.id;

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

    manager.reconcileMission(report);

    expect(manager.getState()?.status).toBe("Victory");
  });

  it("should trigger victory in Extended campaign", () => {
    manager.startNewCampaign(12345, "Standard", { mapGrowthRate: 0.5 });
    const state = manager.getState()!;

    const maxRank = Math.max(...state.nodes.map((n) => n.rank));

    const bossNode = state.nodes.find((n) => n.rank === maxRank)!;
    expect(bossNode.type).toBe("Boss");

    // Must set currentNodeId for reconcileMission to proceed
    state.currentNodeId = bossNode.id;

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

    manager.reconcileMission(report);
    expect(manager.getState()?.status).toBe("Victory");
  });
});

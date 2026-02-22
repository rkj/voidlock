import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "../../../src/engine/generators/SectorMapGenerator";
import { GameRules, MissionType, MapGeneratorType } from "../../../src/shared/types";

describe("SectorMapGenerator Prologue Injection", () => {
  const defaultRules: GameRules = {
    mode: "Preset",
    difficulty: "Clone",
    deathRule: "Clone",
    allowTacticalPause: true,
    mapGeneratorType: MapGeneratorType.DenseShip,
    difficultyScaling: 1.0,
    resourceScarcity: 1.0,
    startingScrap: 500,
    mapGrowthRate: 0.5,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1.0,
    economyMode: "Open",
    skipPrologue: false,
  };

  it("should set missionType to Prologue for rank 0 when skipPrologue is false", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(12345, defaultRules);

    expect(nodes.length).toBeGreaterThan(0);
    const rank0Nodes = nodes.filter(n => n.rank === 0);
    expect(rank0Nodes.length).toBe(1);
    expect(rank0Nodes[0].missionType).toBe(MissionType.Prologue);
    expect(rank0Nodes[0].status).toBe("Accessible");

    // Check that rank 1 has 3-4 nodes (connected to rank 0)
    const rank1Nodes = nodes.filter(n => n.rank === 1);
    expect(rank1Nodes.length).toBeGreaterThanOrEqual(3);
    expect(rank1Nodes.every(n => n.status === "Revealed")).toBe(true);
    
    // Check connections from prologue
    const prologueConnections = rank0Nodes[0].connections;
    const rank1NodeIds = rank1Nodes.map(n => n.id);
    expect(prologueConnections).toEqual(expect.arrayContaining(rank1NodeIds));
  });

  it("should NOT set missionType to Prologue when skipPrologue is true", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(12345, { ...defaultRules, skipPrologue: true });

    const prologueNode = nodes.find(n => n.missionType === MissionType.Prologue);
    expect(prologueNode).toBeUndefined();
    
    const rank0Nodes = nodes.filter(n => n.rank === 0);
    expect(rank0Nodes.length).toBe(1);
    expect(rank0Nodes[0].status).toBe("Accessible");
    expect(rank0Nodes[0].missionType).not.toBe(MissionType.Prologue);
  });
});

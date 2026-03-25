import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "../../../src/engine/generators/SectorMapGenerator";
import { MissionType, MapGeneratorType } from "../../../src/shared/types";

describe("SectorMapGenerator Prologue Injection", () => {
  const defaultRules = {
    mode: "Preset",
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
    skipPrologue: false,
  };

  it("should generate a valid rank 0 node that is Accessible", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules: defaultRules });

    expect(nodes.length).toBeGreaterThan(0);
    const rank0Nodes = nodes.filter(n => n.rank === 0);
    expect(rank0Nodes.length).toBe(1);
    expect(rank0Nodes[0].status).toBe("Accessible");

    // Check that rank 1 has 3-4 nodes (connected to rank 0)
    const rank1Nodes = nodes.filter(n => n.rank === 1);
    expect(rank1Nodes.length).toBeGreaterThanOrEqual(3);

    // Check connections from rank 0
    const rank0Connections = rank0Nodes[0].connections;
    const rank1NodeIds = rank1Nodes.map(n => n.id);
    expect(rank0Connections).toEqual(expect.arrayContaining(rank1NodeIds));
  });

  it("should generate a Boss node at the final rank", () => {
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules: defaultRules });

    const maxRank = Math.max(...nodes.map(n => n.rank));
    const bossNodes = nodes.filter(n => n.rank === maxRank);
    expect(bossNodes.length).toBe(1);
    expect(bossNodes[0].type).toBe("Boss");
  });
});

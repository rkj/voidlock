import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { GameRules, calculateMapSize, calculateSpawnPoints } from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types";

describe("Regression: g77z Map Scaling", () => {
  const baseRules: GameRules = {
    mode: "Custom",
    difficulty: "Clone",
    deathRule: "Clone",
    allowTacticalPause: true,
    mapGeneratorType: MapGeneratorType.DenseShip,
    difficultyScaling: 1.0,
    resourceScarcity: 1.0,
    startingScrap: 500,
    mapGrowthRate: 1.0,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1,
    economyMode: "Open",
  };

  it("should generate 7 layers for standard growth rate (1.0)", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, baseRules);
    
    const maxRank = Math.max(...nodes.map(n => n.rank));
    expect(maxRank).toBe(6);
    
    // Check rank assignment
    nodes.forEach(node => {
        expect(node.id).toContain(`node_${node.rank}_`);
    });
  });

  it("should generate 13 layers for extended growth rate (0.5)", () => {
    const generator = new SectorMapGenerator();
    const rules = { ...baseRules, mapGrowthRate: 0.5 };
    const nodes = generator.generate(123, rules);
    
    const maxRank = Math.max(...nodes.map(n => n.rank));
    expect(maxRank).toBe(12);
  });

  it("should calculate correct map sizes based on rank and growth rate", () => {
    // Standard Growth (1.0)
    expect(calculateMapSize(0, 1.0)).toBe(6);
    expect(calculateMapSize(1, 1.0)).toBe(7);
    expect(calculateMapSize(6, 1.0)).toBe(12);
    expect(calculateMapSize(10, 1.0)).toBe(12); // Cap

    // Extended Growth (0.5)
    expect(calculateMapSize(0, 0.5)).toBe(6);
    expect(calculateMapSize(1, 0.5)).toBe(6);
    expect(calculateMapSize(2, 0.5)).toBe(7);
    expect(calculateMapSize(12, 0.5)).toBe(12);
    expect(calculateMapSize(20, 0.5)).toBe(12); // Cap
  });

  it("should calculate correct spawn points based on map size", () => {
    expect(calculateSpawnPoints(6)).toBe(1);
    expect(calculateSpawnPoints(7)).toBe(1);
    expect(calculateSpawnPoints(8)).toBe(2);
    expect(calculateSpawnPoints(9)).toBe(2);
    expect(calculateSpawnPoints(10)).toBe(3);
    expect(calculateSpawnPoints(11)).toBe(3);
    expect(calculateSpawnPoints(12)).toBe(4);
  });
});

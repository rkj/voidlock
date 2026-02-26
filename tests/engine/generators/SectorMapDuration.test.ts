import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { GameRules } from "@src/shared/campaign_types";
import { MapGeneratorType } from "@src/shared/types";

describe("SectorMapGenerator Duration", () => {
  const mockRules = (mapGrowthRate: number): GameRules => ({
    mode: "Preset",
    difficulty: "Clone",
    deathRule: "Clone",
    allowTacticalPause: true,
    mapGeneratorType: MapGeneratorType.DenseShip,
    difficultyScaling: 1.0,
    resourceScarcity: 1.0,
    startingScrap: 500,
    mapGrowthRate,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1.0,
    economyMode: "Open",
    skipPrologue: false,
  });

  it("should produce 7 ranks for Short duration (mapGrowthRate = 1.0)", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, mockRules(1.0));
    
    const maxRank = Math.max(...nodes.map(n => n.rank));
    expect(maxRank).toBe(6); // 0 to 6 = 7 ranks
    
    const ranks = new Set(nodes.map(n => n.rank));
    expect(ranks.size).toBe(7);
  });

  it("should produce 13 ranks for Long duration (mapGrowthRate = 0.5)", () => {
    const generator = new SectorMapGenerator();
    const nodes = generator.generate(123, mockRules(0.5));
    
    const maxRank = Math.max(...nodes.map(n => n.rank));
    expect(maxRank).toBe(12); // 0 to 12 = 13 ranks
    
    const ranks = new Set(nodes.map(n => n.rank));
    expect(ranks.size).toBe(13);
  });
});

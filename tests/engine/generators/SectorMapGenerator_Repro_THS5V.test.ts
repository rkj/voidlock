import { describe, it, expect } from "vitest";
import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { MapGeneratorType } from "@src/shared/types";

describe("SectorMapGenerator Orientation Regression voidlock-ths5v", () => {
  const rules = {
    difficultyScaling: 1.0,
    mapGrowthRate: 1.0,
    mapGeneratorType: MapGeneratorType.DenseShip,
  };

  it("should have position.x correlate with rank (left-to-right layout)", () => {
    const layers = 5;
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules, rankCount: layers });

    nodes.forEach(node => {
      const rank = node.rank;
      // rank 0 should have smallest x, rank 4 should have largest x
      // (width / (layers + 1)) * (rank + 1)
      const expectedX = (800 / (layers + 1)) * (rank + 1);
      expect(node.position.x).toBeCloseTo(expectedX);
    });
  });

  it("should have position.y correlate with lane (vertical spacing)", () => {
    const layers = 3;
    const nodes = SectorMapGenerator.generate({ seed: 12345, rules, rankCount: layers });

    // For middle layers where nodeCount = LANES = 4
    const middleNodes = nodes.filter(n => n.rank === 1);
    expect(middleNodes.length).toBe(4);

    middleNodes.sort((a, b) => a.position.y - b.position.y);
    
    middleNodes.forEach((node, index) => {
      // index is the lane 'l'
      const expectedY = (600 / (4 + 1)) * (index + 1);
      expect(node.position.y).toBeCloseTo(expectedY);
    });
  });
});

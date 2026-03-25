import { SectorMapGenerator } from "@src/engine/generators/SectorMapGenerator";
import { MapGeneratorType } from "@src/shared/types";
import { describe, it } from "vitest";

const rules = {
  difficultyScaling: 1,
  skipPrologue: false,
  mapGrowthRate: 1.0,
  mapGeneratorType: MapGeneratorType.DenseShip,
};

describe("Find Seed", () => {
  it("finds a seed where rank 1 has only Combat nodes", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const map = SectorMapGenerator.generate({ seed, rules });
      const nextNodes = map.filter(n => n.rank === 1);
      if (nextNodes.every(n => n.type === "Combat")) {
        console.log("Found seed:", seed);
        break;
      }
    }
  });
});

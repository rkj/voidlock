import { SectorMapGenerator } from "./src/engine/generators/SectorMapGenerator";
import { GameRules } from "./src/shared/types";
import { describe, it } from "vitest";

const rules: GameRules = {
  difficultyScaling: 1,
  skipPrologue: false,
};

describe("Find Seed", () => {
  it("finds a seed where rank 1 has only Combat nodes", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const map = new SectorMapGenerator().generate(seed, rules);
      const nextNodes = map.filter(n => n.rank === 1);
      if (nextNodes.every(n => n.type === "Combat")) {
        console.log("Found seed:", seed);
        break;
      }
    }
  });
});

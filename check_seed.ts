import { SectorMapGenerator } from "./src/engine/generators/SectorMapGenerator";
import { GameRules } from "./src/shared/types";

const rules: GameRules = {
  difficultyScaling: 1,
  skipPrologue: false,
};

const map = new SectorMapGenerator().generate(12345, rules);
const nextNodes = map.nodes.filter(n => n.rank === 1);
console.log("Seed 12345 next nodes:");
for (const n of nextNodes) {
  console.log(n.id, n.type);
}

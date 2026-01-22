import { SectorMapGenerator } from "./src/engine/generators/SectorMapGenerator";
import { PRNG } from "./src/shared/PRNG";
import { MapGeneratorType } from "./src/shared/types";

const rules = {
  mode: "Custom",
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

const generator = new SectorMapGenerator();
const nodes = generator.generate(12345, rules as any);

nodes.forEach((n) => {
  console.log(`Rank ${n.rank}, ID ${n.id}, Type ${n.type}`);
});

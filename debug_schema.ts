import { CampaignStateSchema } from "./src/shared/schemas/campaign";
import pkg from "./package.json";

const mockState = {
  version: pkg.version,
  saveVersion: 1,
  seed: 12345,
  status: "Victory",
  currentSector: 3,
  currentNodeId: "node-1",
  scrap: 500,
  intel: 50,
  rules: {
    mode: "Preset",
    difficulty: "Standard",
    deathRule: "Iron",
    allowTacticalPause: true,
    mapGeneratorType: "DenseShip",
    difficultyScaling: 1.0,
    resourceScarcity: 1.0,
    startingScrap: 500,
    mapGrowthRate: 1.0,
    baseEnemyCount: 3,
    enemyGrowthPerMission: 1.0,
    economyMode: "Open"
  },
  nodes: [
    {
      id: "node-1",
      type: "Combat",
      status: "Cleared",
      difficulty: 1,
      rank: 0,
      mapSeed: 123,
      connections: [],
      position: { x: 0, y: 0 }
    }
  ],
  roster: Array(15).fill(null).map((_, i) => ({
    id: `s${i}`,
    name: `Soldier ${i}`,
    archetypeId: "scout",
    hp: 100,
    maxHp: 100,
    soldierAim: 60,
    xp: 100,
    level: 1,
    kills: 5,
    missions: 2,
    status: "Healthy",
    equipment: {},
    recoveryTime: 0
  })),
  history: Array(20).fill(null).map((_, i) => ({
    nodeId: `node-${i}`,
    seed: 123 + i,
    result: "Won",
    aliensKilled: 10,
    scrapGained: 50,
    intelGained: 5,
    timeSpent: 100,
    soldierResults: []
  })),
  unlockedArchetypes: ["assault", "medic", "scout"],
  unlockedItems: []
};

const result = CampaignStateSchema.safeParse(mockState);
if (result.success) {
  console.log("SUCCESS");
} else {
  console.log("FAILURE");
  console.log(JSON.stringify(result.error.format(), null, 2));
}

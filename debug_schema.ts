import { CampaignStateSchema } from "./src/shared/schemas/campaign";

const mockState = {
      version: "0.139.6",
      saveVersion: 1,
      seed: 123,
      status: "Active",
      rules: {
        mode: "Custom",
        difficulty: "Clone",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        difficultyScaling: 1,
        resourceScarcity: 1,
        startingScrap: 500,
        mapGrowthRate: 1,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1,
        economyMode: "Open",
        skipPrologue: true
      },
      scrap: 500,
      intel: 0,
      currentSector: 1,
      currentNodeId: "node-0",
      nodes: [
        {
          id: "node-0",
          type: "Combat",
          status: "Cleared",
          difficulty: 1,
          rank: 0,
          mapSeed: 123,
          connections: ["node-1", "node-2"],
          position: { x: 0, y: 0 },
          bonusLootCount: 0
        },
        {
          id: "node-1",
          type: "Combat",
          status: "Accessible",
          difficulty: 1,
          rank: 1,
          mapSeed: 124,
          connections: ["node-3"],
          position: { x: 100, y: -50 },
          bonusLootCount: 0
        },
        {
          id: "node-2",
          type: "Combat",
          status: "Accessible",
          difficulty: 1,
          rank: 1,
          mapSeed: 125,
          connections: ["node-3"],
          position: { x: 100, y: 50 },
          bonusLootCount: 0
        },
        {
          id: "node-3",
          type: "Combat",
          status: "Revealed",
          difficulty: 1,
          rank: 2,
          mapSeed: 126,
          connections: [],
          position: { x: 200, y: 0 },
          bonusLootCount: 0
        }
      ],
      roster: [],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout"],
      unlockedItems: []
    };

const result = CampaignStateSchema.safeParse(mockState);
if (result.success) {
    console.log("Validation SUCCESS");
} else {
    console.log("Validation FAILED");
    console.log(JSON.stringify(result.error.format(), null, 2));
}

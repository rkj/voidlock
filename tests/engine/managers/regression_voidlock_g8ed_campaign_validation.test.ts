import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Validation (voidlock-g8ed)", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should handle corrupted campaign state in storage", async () => {
    // 1. Manually set invalid data in storage
    (storage as any).storage.set("voidlock_campaign_v1", "{ invalid json }");

    // 2. Load should handle it gracefully
    const loaded = await manager.load();
    expect(loaded).toBe(false);
    expect(manager.getState()).toBeNull();
  });

  it("should handle missing fields in roster by patching them", async () => {
    const corruptedState = {
      version: "0.1.0",
      seed: 12345,
      status: "Active",
      scrap: 500,
      intel: 0,
      currentSector: 1,
      saveVersion: 1,
      rules: {
        difficulty: "Clone",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        economyMode: "Open",
        difficultyScaling: 1.0,
        resourceScarcity: 1.0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1.0,
        mapGrowthRate: 1.0,
      },
      nodes: [],
      roster: [
        { id: "s1", name: "Broken", archetypeId: "assault" }, // Missing status, hp, etc.
      ],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout"],
      unlockedItems: [],
    };
    storage.save("voidlock_campaign_v1", corruptedState);

    const loaded = await manager.load();
    expect(loaded).toBe(true);
    const state = manager.getState();
    expect(state!.roster[0].hp).toBeDefined();
    expect(state!.roster[0].status).toBe("Healthy");
  });

  it("should patch invalid node types or connections", async () => {
    const corruptedState = {
      version: "0.1.0",
      seed: 123,
      status: "Active",
      scrap: 100,
      intel: 0,
      currentSector: 1,
      saveVersion: 1,
      rules: {
        difficulty: "Clone",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        economyMode: "Open",
        difficultyScaling: 1.0,
        resourceScarcity: 1.0,
        baseEnemyCount: 3,
        enemyGrowthPerMission: 1.0,
        mapGrowthRate: 1.0,
      },
      nodes: [
        {
          id: "n1",
          type: "INVALID_TYPE",
          status: "Accessible",
          rank: 0,
          position: { x: 0, y: 0 },
          connections: [],
        },
      ],
      roster: [],
      history: [],
      unlockedArchetypes: ["assault", "medic", "scout"],
      unlockedItems: [],
    };
    storage.save("voidlock_campaign_v1", corruptedState);

    const loaded = await manager.load();
    expect(loaded).toBe(true);
    const loadedState = manager.getState();
    expect(loadedState!.nodes[0].type).toBe("Combat");
  });
});

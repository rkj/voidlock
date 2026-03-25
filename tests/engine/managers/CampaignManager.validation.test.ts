import { describe, it, expect, beforeEach } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";

describe("CampaignManager Validation", () => {
  let manager: CampaignManager;
  let storage: MockStorageProvider;

  beforeEach(() => {
    CampaignManager.resetInstance();
    storage = new MockStorageProvider();
    manager = CampaignManager.getInstance(storage);
  });

  it("should handle corrupted campaign state in storage by throwing", () => {
    // Manually set invalid data in storage (raw string, not valid JSON object)
    (storage as any).storage.set("voidlock_campaign_state", "{ invalid json }");

    // MockStorageProvider.load does JSON.parse which throws on invalid JSON
    expect(() => manager.load()).toThrow();
    // State should remain null since load threw before assigning
    expect(manager.getState()).toBeNull();
  });

  it("should load state with missing roster fields as-is (no patching)", () => {
    const incompleteState = {
      version: "0.1.0",
      seed: 12345,
      status: "Active",
      scrap: 500,
      intel: 0,
      currentSector: 1,
      saveVersion: 1,
      rules: {
        difficulty: "Standard",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        economyMode: "Normal",
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
    };
    storage.save("voidlock_campaign_state", incompleteState);

    const loaded = manager.load();
    expect(loaded).toBe(true);
    const state = manager.getState();
    // Current implementation loads the state as-is without validation
    expect(state!.roster[0].id).toBe("s1");
    expect(state!.roster[0].name).toBe("Broken");
  });

  it("should load state with invalid node types as-is (no patching)", () => {
    const stateWithInvalidNodes = {
      version: "0.1.0",
      seed: 123,
      status: "Active",
      scrap: 100,
      intel: 0,
      currentSector: 1,
      saveVersion: 1,
      rules: {
        difficulty: "Standard",
        deathRule: "Clone",
        allowTacticalPause: true,
        mapGeneratorType: "DenseShip",
        economyMode: "Normal",
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
    };
    storage.save("voidlock_campaign_state", stateWithInvalidNodes);

    const loaded = manager.load();
    expect(loaded).toBe(true);
    const loadedState = manager.getState();
    // Current implementation loads as-is without node type validation
    expect(loadedState!.nodes[0].type).toBe("INVALID_TYPE");
  });
});

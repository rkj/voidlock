import { describe, it, expect, beforeEach, vi } from "vitest";
import { CampaignManager } from "@src/engine/managers/CampaignManager";
import { MockStorageProvider } from "@src/engine/persistence/MockStorageProvider";
import { CampaignState } from "@src/shared/campaign_types";

describe("CampaignManager Validation", () => {
  let storage: MockStorageProvider;
  let manager: CampaignManager;
  const STORAGE_KEY = "voidlock_campaign_v1";

  beforeEach(() => {
    storage = new MockStorageProvider();
    CampaignManager.resetInstance();
    manager = CampaignManager.getInstance(storage);
  });

  it("should handle corrupted campaign state in storage", () => {
    storage.save(STORAGE_KEY, { something: "is wrong" });

    // It should not crash, but return false or handle it
    const loaded = manager.load();
    expect(loaded).toBe(false);
    expect(manager.getState()).toBeNull();
  });

  it("should handle missing fields in roster by patching them", () => {
    const partialState = {
      version: "0.100.0",
      seed: 12345,
      status: "Active",
      scrap: 100,
      intel: 0,
      currentSector: 1,
      nodes: [
        {
          id: "node_1",
          rank: 0,
          type: "Combat",
          status: "Accessible",
          connections: [],
        },
      ],
      roster: [
        {
          id: "soldier_1",
          name: "Recruit 1",
          archetypeId: "assault",
          // missing stats
        },
      ],
      history: [],
      rules: {
        difficulty: "Standard",
        deathRule: "Iron",
        allowTacticalPause: true,
      },
    };

    storage.save(STORAGE_KEY, partialState);

    const loaded = manager.load();
    expect(loaded).toBe(true);
    const state = manager.getState();
    expect(state!.roster[0].hp).toBeDefined();
    expect(state!.roster[0].maxHp).toBeDefined();
    expect(state!.roster[0].level).toBe(1);
  });

  it("should patch invalid node types or connections", () => {
    const invalidNodes = [
      {
        id: "node_1",
        rank: 0,
        type: "INVALID_TYPE",
        status: "Accessible",
        connections: ["non-existent"],
      },
    ];

    const state = {
      version: "0.100.0",
      seed: 12345,
      status: "Active",
      scrap: 100,
      intel: 0,
      currentSector: 1,
      nodes: invalidNodes,
      roster: [],
      history: [],
      rules: {
        difficulty: "Standard",
        deathRule: "Iron",
        allowTacticalPause: true,
      },
    };

    storage.save(STORAGE_KEY, state);

    const loaded = manager.load();
    expect(loaded).toBe(true);
    const loadedState = manager.getState();
    expect(loadedState!.nodes[0].type).toBe("Combat");
    expect(loadedState!.nodes[0].connections).toEqual([]);
  });
});

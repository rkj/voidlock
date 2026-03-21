import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MissionType } from "@src/shared/types";

describe("Prologue Loot Spawning", () => {
  const mockMap = {
    width: 6,
    height: 6,
    cells: [{ x: 1, y: 1, type: "Floor" as const }],
    spawnPoints: [],
    squadSpawn: { x: 1, y: 1 },
    squadSpawns: [{ x: 1, y: 1 }],
    extraction: { x: 5, y: 5 },
    objectives: [],
    bonusLoot: [{ x: 3, y: 3 }],
  };

  const squadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  it("should spawn a medkit instead of a scrap crate in the prologue", () => {
    const engine = new CoreEngine({
      map: mockMap,
      seed: 12345,
      squadConfig: squadConfig,
      agentControlEnabled: false,
      debugOverlayEnabled: false,
      missionType: MissionType.Prologue
    });

    const state = engine.getState();
    const medkitLoot = state.loot.find(l => l.itemId === "medkit");
    
    expect(medkitLoot).toBeDefined();
    expect(medkitLoot?.pos.x).toBe(3);
    expect(medkitLoot?.pos.y).toBe(3);
  });
});

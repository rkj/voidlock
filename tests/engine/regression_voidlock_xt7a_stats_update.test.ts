import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
  AIProfile,
} from "@src/shared/types";

describe("UnitManager Recalculate Stats Regression", () => {
  let engine: CoreEngine;
  const mockMap: MapDefinition = {
    width: 10,
    height: 10,
    cells: [],
    spawnPoints: [],
    extraction: { x: 9, y: 9 },
    objectives: [],
  };

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      mockMap.cells.push({ x, y, type: CellType.Floor });
    }
  }

  beforeEach(() => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "scout" }],
      inventory: { "light_recon": 1 },
    };
    engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 20,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 100,
        attackRange: 5,
        speed: 200,
        equipmentAccuracyBonus: 0,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      archetypeId: "scout",
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
      body: undefined, // No armor initially
    });
  });

  it("unit should recalculate stats when equipment changes", () => {
    const state = engine.getState();
    const unit = state.units[0];

    // Manually change equipment in the engine state (hacking it for the test)
    // In a real scenario, this might happen via a command or some other manager.
    // If UnitManager.update calls recalculateStats at the start, it should pick this up.
    // @ts-ignore - accessing private state for testing
    engine.state.units[0].body = "light_recon";

    engine.update(100);

    const updatedState = engine.getState();
    const updatedUnit = updatedState.units[0];

    // light_recon adds 50 HP. Scout base HP is 80.
    expect(updatedUnit.maxHp).toBe(130);
  });
});

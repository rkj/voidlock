import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  AIProfile,
  Cell,
  GameState,
} from "@src/shared/types";

describe("Hidden Objectives", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    const cells: Cell[] = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        cells.push({
          x,
          y,
          type: x === 5 ? CellType.Void : CellType.Floor,
        });
      }
    }
    map = {
      width: 10,
      height: 10,
      cells,
      spawnPoints: [],
      objectives: [
        {
          id: "obj1",
          kind: "Recover",
          targetCell: { x: 8, y: 8 },
        },
      ],
    };

    engine = new CoreEngine(
      map,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );
  });

  it("should be hidden initially and revealed when discovered", () => {
    // Unit at (0,0). Sight 5. Objective at (9,9).
    engine.addUnit({
      id: "u1",
      archetypeId: "vip",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
      kills: 0,
      damageDealt: 0,
      objectivesCompleted: 0,
    });

    // Tick 1: Update visibility
    engine.update(100);

    let state = engine.getState();
    const obj = state.objectives[0];

    // (9,9) is not discovered.
    expect(state.discoveredCells).not.toContain("9,9");
    expect(obj.visible).toBeFalsy();

    // Teleport unit close to objective (8,8)
    // Hack state for test speed
    (engine as unknown as { state: GameState }).state.units[0].pos = {
      x: 8.5,
      y: 8.5,
    };

    engine.update(100);
    state = engine.getState();
    const objRevealed = state.objectives[0];

    // (9,9) should be discovered
    expect(state.discoveredCells).toContain("9,9");
    expect(objRevealed.visible).toBe(true);
  });
});

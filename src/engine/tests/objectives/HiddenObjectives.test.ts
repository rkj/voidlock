import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  Objective,
  SquadConfig,
} from "../../../shared/types";

describe("Hidden Objectives", () => {
  let engine: CoreEngine;
  let map: MapDefinition;

  beforeEach(() => {
    // 10x10 open map
    const cells = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        cells.push({ x, y, type: CellType.Floor });
      }
    }
    const objectives: Objective[] = [
      {
        id: "obj1",
        kind: "Recover",
        state: "Pending",
        targetCell: { x: 9, y: 9 },
      },
    ];
    map = {
      width: 10,
      height: 10,
      cells,
      spawnPoints: [],
      extraction: undefined,
      objectives,
    };

    engine = new CoreEngine(map, 123, [], true, false);
    engine.clearUnits();
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
      damage: 10,
      fireRate: 100,
      attackRange: 1,
      sightRange: 5,
      speed: 2,
      commandQueue: [],
    });

    // Tick 1: Update visibility
    engine.update(100);

    let state = engine.getState();
    const obj = state.objectives[0];

    // (9,9) is not discovered.
    expect(state.discoveredCells).not.toContain("9,9");
    expect(obj.visible).toBeFalsy();

    // Teleport unit close to objective (8,8)
    const u1 = engine.getState().units[0]; // Get original ref? No, need to modify via command or hack
    // Hack state for test speed
    (engine as any).state.units[0].pos = { x: 8.5, y: 8.5 };

    engine.update(100);
    state = engine.getState();
    const objRevealed = state.objectives[0];

    // (9,9) should be discovered
    expect(state.discoveredCells).toContain("9,9");
    expect(objRevealed.visible).toBe(true);
  });
});

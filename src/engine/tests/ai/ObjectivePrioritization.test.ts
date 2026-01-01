import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
} from "../../../shared/types";

describe("Objective Prioritization AI", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    mockMap = {
      width: 5,
      height: 5,
      cells: [],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 4, y: 4 },
      objectives: [
        {
          id: "obj1",
          kind: "Recover",
          targetCell: { x: 4, y: 0 },
        },
      ],
    };

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        mockMap.cells.push({ x, y, type: CellType.Floor });
      }
    }

    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false);
    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 500,
      accuracy: 1000,
      attackRange: 2,
      sightRange: 0.1,
      speed: 10, // 1 tile per second (1000ms)
      commandQueue: [],
      archetypeId: "assault",
      soldierAim: 90,
      equipmentAccuracyBonus: 0,
    });
  });

  it("should interrupt exploration when an objective becomes visible", () => {
    // 1. Initial update to start exploration.
    // From (0,0), sight 1.5. (2,0) is NOT visible. (4,0) is definitely NOT visible.
    engine.update(100);

    const state1 = engine.getState();
    const unit1 = state1.units[0];
    expect(unit1.state).toBe(UnitState.Moving);
    expect(unit1.activeCommand?.label).toBe("Exploring");
    const initialTarget = { ...unit1.targetPos };

    // 2. Objective is at (4,0). Let's make it visible.
    // We must modify the actual engine state, not the copy from getState.
    (engine as any).state.units[0].sightRange = 10;

    // 3. Update again. The AI should re-evaluate and see the visible objective.
    engine.update(100);

    const state2 = engine.getState();
    const unit2 = state2.units[0];

    // If the fix is implemented, it should now be moving towards the objective (4,0)
    // instead of continuing to initialTarget.
    expect(unit2.activeCommand?.label).toBe("Recovering");
    expect((unit2.activeCommand as any).target.x).toBe(4);
    expect((unit2.activeCommand as any).target.y).toBe(0);
    expect(unit2.explorationTarget).toBeUndefined();
  });
});

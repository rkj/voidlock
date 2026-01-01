import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../shared/types";

describe("Regression MPLV: Objective Ignored During Exploration", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = {
    soldiers: [{ archetypeId: "assault" }],
    inventory: {},
  };

  beforeEach(() => {
    mockMap = {
      width: 10,
      height: 10,
      cells: [],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 9, y: 9 },
      objectives: [
        {
          id: "obj1",
          kind: "Recover",
          targetCell: { x: 5, y: 5 },
        },
      ],
    };

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        mockMap.cells.push({ x, y, type: CellType.Floor });
      }
    }

    // Initialize engine with all cells discovered EXCEPT where the objective is
    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false);
    const state = (engine as any).state;
    state.discoveredCells = [];

    // Discover some cells far away to trigger exploration
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const key = `${x},${y}`;
        state.discoveredCells.push(key);
      }
    }

    engine.clearUnits();
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 500,
        accuracy: 100,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 10,
        sightRange: 5, // Objective at (5,5) is just out of sight from (0,0)
        speed: 10,
      },
      commandQueue: [],
      archetypeId: "assault",
      aiEnabled: true,
    } as any);
  });

  it("should prioritize objective as soon as it becomes visible during exploration", () => {
    // 1. Initial update to start exploration.
    // Unit at (0.5, 0.5). Sight 5. Objective at (5,5) is NOT visible.
    // Closest undiscovered cell should be somewhere around (3,0) or (0,3).
    engine.update(100);

    const state1 = engine.getState();
    const unit1 = state1.units[0];
    expect(unit1.activeCommand?.label).toBe("Exploring");
    expect(unit1.explorationTarget).toBeDefined();

    // 2. Move unit closer to objective so it becomes visible
    (engine as any).state.units[0].pos = { x: 2.5, y: 2.5 };
    // Now objective at (5,5) should be within sight 5.

    // 3. Update again. The AI should re-evaluate and see the visible objective.
    engine.update(100);

    const state2 = engine.getState();
    const unit2 = state2.units[0];

    console.log("Unit Label:", unit2.activeCommand?.label);
    console.log("Exploration Target:", unit2.explorationTarget);
    console.log("Target Pos:", unit2.targetPos);

    // If the fix is implemented, it should now be moving towards the objective (5,5)
    expect(unit2.activeCommand?.label).toBe("Recovering");
    expect(unit2.explorationTarget).toBeUndefined();
    // It should have moved one step from (2,2) towards (5,5).
    // Depending on pathfinder, it could be (3.5, 2.5) or (2.5, 3.5).
    expect([2.5, 3.5]).toContain(unit2.targetPos?.x);
    expect([2.5, 3.5]).toContain(unit2.targetPos?.y);
  });
});

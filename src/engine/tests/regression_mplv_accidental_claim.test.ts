import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  SquadConfig,
} from "../../shared/types";

describe("Regression MPLV: Exploration Target Overlaps Objective", () => {
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

    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false);
    engine.clearUnits();
  });

  it("should switch from Exploring to Recovering even if the target cell is the same", () => {
    // Soldier at (0,0)
    engine.addUnit({
      id: "u1",
      pos: { x: 0.5, y: 0.5 },
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      damage: 10,
      fireRate: 500,
      accuracy: 100,
      soldierAim: 90,
      attackRange: 10,
      sightRange: 5,
      speed: 10,
      commandQueue: [],
      archetypeId: "assault",
      aiEnabled: true,
      explorationTarget: { x: 5, y: 5 }, // Pre-set exploration target to objective cell
      activeCommand: {
        type: "MOVE_TO",
        unitIds: ["u1"],
        target: { x: 5, y: 5 },
        label: "Exploring",
      },
    } as any);

    // Objective O is at (5,5). It is currently NOT visible because it's at distance ~7.

    // 1. Move unit closer so objective becomes visible
    (engine as any).state.units[0].pos = { x: 2.5, y: 2.5 };

    // 2. Update.
    // updateObjectives should mark it visible.
    // unitManager should re-evaluate.
    engine.update(100);

    const state = engine.getState();
    const unit = state.units[0];

    console.log("Unit Label:", unit.activeCommand?.label);

    // If the bug exists, it will still be "Exploring" because O was already in claimedObjectives
    // because u1 was "Exploring" O's cell.
    expect(unit.activeCommand?.label).toBe("Recovering");
  });
});

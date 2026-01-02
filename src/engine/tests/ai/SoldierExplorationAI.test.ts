import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "../../CoreEngine";
import {
  MapDefinition,
  CellType,
  UnitState,
  CommandType,
  SquadConfig,
  Vector2,
  AIProfile,
} from "../../../shared/types";
import { GameGrid } from "../../GameGrid";

describe("Soldier Exploration AI", () => {
  let engine: CoreEngine;
  let mockMap: MapDefinition;
  const defaultSquad: SquadConfig = {
    soldiers: [],
    inventory: {},
  };

  beforeEach(() => {
    // A 3x3 map with walls blocking LOS
    mockMap = {
      width: 3,
      height: 3,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Wall },
        { x: 1, y: 1, type: CellType.Wall },
        { x: 2, y: 1, type: CellType.Floor },
        { x: 0, y: 2, type: CellType.Floor },
        { x: 1, y: 2, type: CellType.Floor },
        { x: 2, y: 2, type: CellType.Floor },
      ],
      spawnPoints: [{ id: "s1", pos: { x: 0, y: 0 }, radius: 1 }],
      extraction: { x: 0, y: 2 },
      objectives: [
        {
          id: "obj_explore",
          kind: "Recover",
          targetCell: { x: 99, y: 0 },
        },
      ],
    };

    engine = new CoreEngine(mockMap, 123, defaultSquad, true, false); // agentControlEnabled = true
    engine.clearUnits(); // Clear default unit to add our own
    engine.addUnit({
      id: "u1",
      archetypeId: "assault",
      pos: { x: 0.5, y: 0.5 }, // Start at (0,0)
      hp: 100,
      maxHp: 100,
      state: UnitState.Idle,
      stats: {
        damage: 10,
        fireRate: 100,
        accuracy: 1000,
        soldierAim: 90,
        equipmentAccuracyBonus: 0,
        attackRange: 5,
        speed: 20,
      },
      aiProfile: AIProfile.STAND_GROUND,
      commandQueue: [],
    });
  });

  it("should move towards the closest undiscovered cell when idle", () => {
    // At start, only (0,0) is discovered (unit sight range 0.1) by LOS after first update.
    // Closest undiscovered from (0,0) is (0,1) or (1,0) (distance 1)

    // Simulate several updates to allow AI to kick in and move
    for (let i = 0; i < 2; i++) {
      // Reduced to 2 ticks to ensure it's still moving
      engine.update(100);
    }
    const state = engine.getState();
    const unit = state.units[0];

    expect(unit.state).toBe(UnitState.Moving);

    // Continue until discoveredCells grows
    for (let i = 0; i < 20; i++) {
      engine.update(100);
    }
    const finalState = engine.getState();
    // Unit should have moved, and discovered cells should be more than 1
    expect(finalState.discoveredCells.length).toBeGreaterThan(1);
  });

  it("should move towards extraction once the entire map is discovered", () => {
    // Force map to be fully discovered
    // Manually add all floor cells to discoveredCells
    const internalState = (engine as any).state;
    internalState.objectives = []; // Objectives complete
    mockMap.cells.forEach((c) => {
      internalState.discoveredCells.push(`${c.x},${c.y}`);
    });
    // Remove duplicates and ensure unique
    internalState.discoveredCells = Array.from(
      new Set(internalState.discoveredCells),
    );

    // Unit is at (0.5,0.5). Extraction is at (0,2).
    // Simulate updates until unit reaches extraction
    for (let i = 0; i < 100; i++) {
      // Enough time for unit to move from (0,0) to (0,2) AND Channel (5s)
      engine.update(100);
    }
    const state = engine.getState();
    const unit = state.units[0];

    expect(state.discoveredCells.length).toBeGreaterThanOrEqual(
      mockMap.cells.filter((c) => c.type === CellType.Floor).length,
    );
    expect(unit.state).toBe(UnitState.Extracted); // Should be extracted if it reached
    // Check if unit is within the extraction cell
    expect(Math.floor(unit.pos.x)).toBe(mockMap.extraction!.x);
    expect(Math.floor(unit.pos.y)).toBe(mockMap.extraction!.y);
  });
});

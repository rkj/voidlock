import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
} from "@src/shared/types";

describe("Snapshot Map Data Regression (voidlock-22u0)", () => {
  const mockMap: MapDefinition = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ],
    walls: [
        { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } }
    ],
    extraction: { x: 0, y: 1 },
  };

  it("should have map data in the first state, but empty in snapshots taken later", () => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    const engine = new CoreEngine(mockMap, 123, defaultSquad, false, false, undefined, false, 0, 1.0, false, undefined, [], true, 0, 3, 1, 0, "Combat", undefined, undefined, true, true, 16);
    
    // First getState should have cells
    const firstState = engine.getState(true);
    expect(firstState.map.cells.length).toBeGreaterThan(0);
    expect(firstState.map.walls!.length).toBeGreaterThan(0);

    // Advance engine to trigger snapshot
    engine.update(16);

    // Second getState should NOT have cells (if sentMap worked as intended)
    const secondState = engine.getState(true);
    expect(secondState.map.cells.length).toBe(0);

    // Check snapshots
    const stateWithSnapshots = engine.getState(false, true);
    expect(stateWithSnapshots.snapshots.length).toBeGreaterThan(0);
    
    const firstSnapshot = stateWithSnapshots.snapshots[0];
    // This snapshot was taken DURING the update(16) call, which calls simulationStep, which calls getState(false, false)
    // In simulationStep:
    // 1. getState(false, false) is called to create snapshot.
    // Wait, let's see simulationStep in CoreEngine.ts
    
    expect(firstSnapshot.map.cells.length).toBe(0);
  });
});

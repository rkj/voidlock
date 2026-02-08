import { describe, it, expect, beforeEach } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { CellType, EngineMode } from "@src/shared/types";

describe("CoreEngine sentMap Logic (voidlock-0u4r)", () => {
  const mockMap = {
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Floor },
    ],
    walls: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
  };

  it("should NOT set sentMap=true when getState is called without pruneForObservation", () => {
    const engine = new CoreEngine(
      mockMap as any,
      123,
      { soldiers: [], inventory: {} },
      true,
      false,
    );

    // Call getState as a snapshot would (pruneForObservation = false)
    const snapshot = engine.getState(false);
    expect(snapshot.map.cells.length).toBeGreaterThan(0);

    // Now call getState for observation (pruneForObservation = true)
    // It should STILL include the map because sentMap should be false.
    const observation = engine.getState(true);
    expect(observation.map.cells.length).toBeGreaterThan(0);

    // THIRD call for observation should now have empty map
    const observation2 = engine.getState(true);
    expect(observation2.map.cells.length).toBe(0);
  });
});

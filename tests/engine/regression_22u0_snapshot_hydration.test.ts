import { describe, it, expect, beforeEach, vi } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import {
  MapDefinition,
  CellType,
  SquadConfig,
  EngineMode,
} from "@src/shared/types";

describe("Snapshot Hydration Regression (voidlock-22u0)", () => {
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

  it("should have empty map data in getState if hydrated from a snapshot that had empty map data", () => {
    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };
    
    // 1. Create original engine and get a snapshot
    const originalEngine = new CoreEngine(mockMap, 123, defaultSquad, false, false, undefined, false, 0, 1.0, false, undefined, [], true, 0, 3, 1, 0, "Combat", undefined, undefined, true, true, 16);
    
    // First getState should have cells, sets sentMap = true
    const firstState = originalEngine.getState();
    expect(firstState.map.cells.length).toBeGreaterThan(0);

    // Trigger snapshot - this will now have cells: [] because sentMap is true
    originalEngine.update(16);
    const stateWithSnapshots = originalEngine.getState(false, true);
    const snapshot = stateWithSnapshots.snapshots[0];
    expect(snapshot.map.cells.length).toBe(0);

    // 2. Create a new engine and hydrate from that snapshot
    // We simulate what init does when targetTick > 0
    const newEngine = new CoreEngine(mockMap, 123, defaultSquad, false, false, undefined, false, 0, 1.0, false, EngineMode.Replay, [], true, 16, 3, 1, 0, "Combat", undefined, undefined, true, true, 16, [snapshot]);
    
    // The first getState from the new engine should have the full map, 
    // but because it hydrated from a snapshot that had cells=[], it will have cells=[]!
    const stateFromNewEngine = newEngine.getState();
    
    // RED: This is expected to fail (it will be 0) because of the bug
    expect(stateFromNewEngine.map.cells.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { CoreEngine } from "@src/engine/CoreEngine";
import { MapDefinition, CellType, SquadConfig } from "@src/shared/types";

describe("Regression voidlock-aja3: Authoritative Entity Visibility", () => {
  it("should always include spawnPoints in state update even after initial map send", () => {
    const mockMap: MapDefinition = {
      width: 3,
      height: 3,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
        { x: 0, y: 2, type: CellType.Floor },
        { x: 1, y: 2, type: CellType.Floor },
        { x: 2, y: 2, type: CellType.Floor },
      ],
      spawnPoints: [{ id: "sp1", pos: { x: 1, y: 1 }, radius: 1 }],
      objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 2, y: 0 } }],
    };

    const defaultSquad: SquadConfig = {
      soldiers: [{ archetypeId: "assault" }],
      inventory: {},
    };

    const engine = new CoreEngine(mockMap, 123, defaultSquad, false, false);

    // First call to getState() sets sentMap = true
    const state1 = engine.getState(true);
    expect(state1.map.spawnPoints).toHaveLength(1);
    expect(state1.map.objectives).toHaveLength(1);
    expect(state1.map.cells).not.toHaveLength(0);

    // Second call to getState() should still include spawnPoints and objectives, but NOT cells
    const state2 = engine.getState(true);
    expect(state2.map.spawnPoints).toHaveLength(1);
    expect(state2.map.objectives).toHaveLength(1);
    expect(state2.map.cells).toHaveLength(0);
  });
});

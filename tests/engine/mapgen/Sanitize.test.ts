import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { MapDefinition, CellType } from "@src/shared/types";

describe("MapGenerator.sanitize", () => {
  it("should mark unreachable Floor cells as Void", () => {
    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      walls: [{ p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } }], // Blocked
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    };

    MapGenerator.sanitize(map);

    // After fix, map.cells should only contain (0,0) because (1,0) became Void and was omitted
    expect(map.cells.length).toBe(1);
    expect(map.cells[0].x).toBe(0);
    expect(map.cells[0].y).toBe(0);
    expect(map.cells[0].type).toBe(CellType.Floor);
  });

  it("should keep reachable Floor cells as Floor", () => {
    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      walls: [], // Open
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    };

    MapGenerator.sanitize(map);

    expect(map.cells[0].type).toBe(CellType.Floor);
    expect(map.cells[1].type).toBe(CellType.Floor);
  });
});

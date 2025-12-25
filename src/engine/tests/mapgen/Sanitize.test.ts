import { describe, it, expect } from "vitest";
import { MapGenerator } from "../../MapGenerator";
import { MapDefinition, CellType } from "../../../shared/types";
import { Graph } from "../../Graph";

describe("MapGenerator.sanitize", () => {
  it("should mark unreachable Floor cells as Wall", () => {
    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      walls: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }], // Blocked
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    };

    MapGenerator.sanitize(map);

    expect(map.cells[0].type).toBe(CellType.Floor);
    expect(map.cells[1].type).toBe(CellType.Wall);
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

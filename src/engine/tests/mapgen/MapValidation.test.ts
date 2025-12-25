import { describe, it, expect, beforeEach } from "vitest";
import { MapGenerator } from "../../MapGenerator";
import { MapDefinition, CellType, Cell, Door } from "../../../shared/types";

describe("MapGenerator.validate", () => {
  let generator: MapGenerator;

  beforeEach(() => {
    generator = new MapGenerator(123);
  });

  const createBaseMap = (): MapDefinition => ({
    width: 3,
    height: 1,
    cells: [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 2, y: 0, type: CellType.Floor },
    ],
    spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    extraction: { x: 2, y: 0 },
    objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 1, y: 0 } }],
    walls: [],
  });

  it("should invalidate map if Floor cell is unreachable due to wall", () => {
    const map = createBaseMap();
    // Put wall between 0,0 and 1,0
    map.walls = [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 0) is not reachable from any spawn point.",
    );
  });

  it("should invalidate map if extraction is unreachable due to wall", () => {
    const map = createBaseMap();
    // Put wall between 1,0 and 2,0
    map.walls = [{ p1: { x: 1, y: 0 }, p2: { x: 2, y: 0 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (2, 0) is not reachable from any spawn point.",
    );
  });

  it("should invalidate map if objective is unreachable due to wall", () => {
    const map = createBaseMap();
    // Put wall between 0,0 and 1,0
    map.walls = [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 0) is not reachable from any spawn point.",
    );
  });
});

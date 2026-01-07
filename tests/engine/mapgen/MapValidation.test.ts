import { describe, it, expect, beforeEach } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { MapDefinition, CellType, Cell, Door } from "@src/shared/types";

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
    map.walls = [{ p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 0) is not reachable from any spawn point.",
    );
  });

  it("should invalidate map if extraction is unreachable due to wall", () => {
    const map = createBaseMap();
    // Put wall between 1,0 and 2,0
    map.walls = [{ p1: { x: 2, y: 0 }, p2: { x: 2, y: 1 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (2, 0) is not reachable from any spawn point.",
    );
  });

  it("should invalidate map if objective is unreachable due to wall", () => {
    const map = createBaseMap();
    // Put wall between 0,0 and 1,0
    map.walls = [{ p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } }];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 0) is not reachable from any spawn point.",
    );
  });

  it("should invalidate map with an open boundary between Floor and Void", () => {
    const map = createBaseMap();
    map.cells[1].type = CellType.Void;
    // Boundary between (0,0) and (1,0) is open by default (walls: [])
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Open boundary at (0,0)--(1,0) must be between two Floor cells.",
    );
  });

  it("should invalidate map if Enemy Spawn is on a Void cell", () => {
    const map = createBaseMap();
    map.cells[0].type = CellType.Void;
    // (0,0) has spawnPoint sp1
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Spawn point sp1 at (0, 0) is not on a Floor cell.",
    );
  });

  it("should invalidate map if Squad Spawn is on a Void cell", () => {
    const map = createBaseMap();
    map.squadSpawn = { x: 1, y: 0 };
    map.cells[1].type = CellType.Void;
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Squad spawn point at (1, 0) is not on a Floor cell.",
    );
  });

  it("should invalidate map if Extraction is on a Void cell", () => {
    const map = createBaseMap();
    map.cells[2].type = CellType.Void;
    // (2,0) is extraction
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Extraction point at (2, 0) is not on a Floor cell.",
    );
  });

  it("should invalidate map if Objective is on a Void cell", () => {
    const map = createBaseMap();
    map.cells[1].type = CellType.Void;
    // (1,0) is objective obj1
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Objective obj1 at (1, 0) is not on a Floor cell.",
    );
  });
});

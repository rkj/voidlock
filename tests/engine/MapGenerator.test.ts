import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import {
  CellType,
  MapDefinition,
  IMapValidationResult,
  Door,
  Vector2,
  MapGeneratorType,
} from "@src/shared/types";

describe("MapGenerator", () => {
  it("should generate a map with cells and walls", () => {
    const generator = new MapGenerator({
      seed: 123,
      width: 16,
      height: 16,
      type: MapGeneratorType.Procedural,
    });
    const map = generator.generate();

    expect(map.width).toBe(16);
    expect(map.height).toBe(16);
    expect(map.cells.length).toBeLessThanOrEqual(256);
    expect(map.cells.length).toBeGreaterThan(20);

    // All should be floor
    const floors = map.cells.filter((c) => c.type === CellType.Floor);
    expect(floors.length).toBe(map.cells.length);

    // Check extraction
    expect(map.extraction).toBeDefined();

    // Check if any boundaries are open
    expect(map.walls).toBeDefined();
    expect(map.walls!.length).toBeLessThan(480 + 64);
  });

  it("should be deterministic with same seed", () => {
    const config = {
      seed: 555,
      width: 10,
      height: 10,
      type: MapGeneratorType.Procedural,
    };
    const gen1 = new MapGenerator(config);
    const map1 = gen1.generate();

    const gen2 = new MapGenerator(config);
    const map2 = gen2.generate();

    expect(map1).toEqual(map2);
  });
});

describe("MapGenerator.validate", () => {
  const createBaseMap = (): MapDefinition => ({
    width: 2,
    height: 2,
    cells: [
      { x: 0, y: 0, type: CellType.Floor, roomId: "room-1" },
      { x: 1, y: 0, type: CellType.Floor, roomId: "room-2" },
      { x: 0, y: 1, type: CellType.Floor, roomId: "room-3" },
      { x: 1, y: 1, type: CellType.Floor, roomId: "room-4" },
    ],
    spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    squadSpawn: { x: 1, y: 1 },
    extraction: { x: 1, y: 0 },
    objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 0, y: 1 } }],
    walls: [],
  });

  const defaultConfig = {
    seed: 1,
    width: 10,
    height: 10,
    type: MapGeneratorType.Procedural,
  };

  it("should validate a simple valid map", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    const result = generator.validate(map);
    expect(result.isValid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("should invalidate map with non-positive dimensions", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    map.width = 0;
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Map dimensions (width and height) must be positive.",
    );
  });

  it("should invalidate map with cells out of bounds", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    map.cells[0] = { x: -1, y: 0, type: CellType.Floor };
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain("Cell at (-1, 0) is out of map bounds.");
  });

  it("should invalidate map with unreachable floor cells", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    map.walls = [
      { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
      { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } },
    ];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 1) is not reachable from any spawn point.",
    );
  });

  it("should invalidate map if extraction is unreachable", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    map.extraction = { x: 1, y: 1 };
    map.walls = [
      { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
      { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } },
    ];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 1) is not reachable from any spawn point.",
    );
  });

  it("should validate map if a door provides reachability", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    map.walls = [];
    map.doors = [
      {
        id: "d1",
        segment: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        orientation: "Vertical",
        state: "Closed",
        hp: 100,
        maxHp: 100,
        openDuration: 1,
      },
    ];
    const result = generator.validate(map);
    expect(result.isValid).toBe(true);
  });

  it("should invalidate map if a LOCKED door is the only path", () => {
    const generator = new MapGenerator(defaultConfig);
    const map = createBaseMap();
    map.walls = [
      { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
      { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } },
    ];
    map.doors = [
      {
        id: "d1",
        segment: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        orientation: "Vertical",
        state: "Locked",
        hp: 100,
        maxHp: 100,
        openDuration: 1,
      },
    ];
    const result = generator.validate(map);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Floor cell at (1, 0) is not reachable from any spawn point.",
    );
  });
});

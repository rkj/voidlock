import { describe, it, expect } from "vitest";
import { MapFactory } from "../../../src/engine/map/MapFactory";
import { MapSanitizer } from "../../../src/engine/map/MapSanitizer";
import { MapValidator } from "../../../src/engine/map/MapValidator";
import {
  MapGeneratorType,
  CellType,
  MapDefinition,
} from "../../../src/shared/types";

describe("Modular Map Generation", () => {
  it("MapFactory should generate a map and sanitize it", () => {
    const config = {
      seed: 12345,
      width: 16,
      height: 16,
      type: MapGeneratorType.Procedural,
      spawnPointCount: 1,
    };
    const map = MapFactory.generate(config);
    expect(map).toBeDefined();
    expect(map.width).toBe(16);
    expect(map.height).toBe(16);

    // Check if it's sanitized (no Void cells in map.cells)
    const hasVoid = map.cells.some((c) => c.type === CellType.Void);
    expect(hasVoid).toBe(false);
  });

  it("MapValidator should identify issues in an invalid map", () => {
    const invalidMap = {
      width: 0,
      height: 16,
      cells: [],
      walls: [],
    } as unknown as MapDefinition;
    const result = MapValidator.validate(invalidMap);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      "Map dimensions (width and height) must be positive.",
    );
    expect(result.issues).toContain("No spawn points defined.");
  });

  it("MapSanitizer should remove unreachable cells", () => {
    const map = {
      width: 3,
      height: 3,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 2, type: CellType.Floor }, // Unreachable if no connections
      ],
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 } }],
      walls: [
        { p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } }, // Wall between (0,0) and (1,0)? No, vertical wall at x=1.
      ],
    } as unknown as MapDefinition;
    // Re-calculating walls/boundaries for 3x3 to make it clearer
    // (0,0)-(1,0) is horizontal adjacency. Wall is vertical at x=1.

    MapSanitizer.sanitize(map);

    const reachableCells = map.cells.map((c) => `${c.x},${c.y}`);
    expect(reachableCells).toContain("0,0");
    expect(reachableCells).not.toContain("2,2");
  });
});

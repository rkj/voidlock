import { describe, it, expect } from "vitest";
import { MapValidator } from "@src/shared/validation/MapValidator";

describe("MapValidator", () => {
  it("should validate a correct map definition", () => {
    const validMap = {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: "Floor" },
        { x: 1, y: 0, type: "Void" },
      ],
      squadSpawn: { x: 0, y: 0 },
      extraction: { x: 9, y: 9 },
      objectives: [{ id: "obj1", kind: "Recover", targetCell: { x: 5, y: 5 } }],
      spawnPoints: [{ id: "sp1", pos: { x: 2, y: 2 }, radius: 1 }],
      walls: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } }],
      bonusLoot: [{ x: 3, y: 3 }],
    };

    expect(MapValidator.validateMapData(validMap)).toBe(true);
  });

  it("should fail if width or height are missing or out of bounds", () => {
    expect(MapValidator.validateMapData({ height: 10, cells: [] })).toBe(false);
    expect(
      MapValidator.validateMapData({ width: 0, height: 10, cells: [] }),
    ).toBe(false);
    expect(
      MapValidator.validateMapData({ width: 101, height: 10, cells: [] }),
    ).toBe(false);
  });

  it("should fail if cells are missing or invalid", () => {
    expect(MapValidator.validateMapData({ width: 10, height: 10 })).toBe(false);
    expect(
      MapValidator.validateMapData({ width: 10, height: 10, cells: {} }),
    ).toBe(false);
    expect(
      MapValidator.validateMapData({
        width: 10,
        height: 10,
        cells: [{ x: 0, y: 0, type: "Invalid" }],
      }),
    ).toBe(false);
  });

  it("should fail if optional fields have invalid structure", () => {
    const mapWithInvalidSpawn = {
      width: 10,
      height: 10,
      cells: [],
      squadSpawn: { x: "0", y: 0 },
    };
    expect(MapValidator.validateMapData(mapWithInvalidSpawn)).toBe(false);

    const mapWithInvalidObjective = {
      width: 10,
      height: 10,
      cells: [],
      objectives: [{ id: "obj1", kind: "InvalidKind" }],
    };
    expect(MapValidator.validateMapData(mapWithInvalidObjective)).toBe(false);
  });
});

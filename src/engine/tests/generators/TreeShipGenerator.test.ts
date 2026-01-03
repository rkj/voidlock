import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { CellType } from "@src/shared/types";

describe("TreeShipGenerator", () => {
  it("should generate a valid map with a tree structure", () => {
    const generator = new TreeShipGenerator(12345, 16, 16);
    const map = generator.generate();

    expect(map.width).toBe(16);
    expect(map.height).toBe(16);

    const floors = map.cells.filter((c) => c.type === CellType.Floor);
    // Adjust expectation for smaller map (16x16=256)
    // >20 is still valid.
    expect(floors.length).toBeGreaterThan(20);

    // Basic feature check
    expect(map.spawnPoints?.length).toBeGreaterThan(0);
    expect(map.extraction).toBeDefined();
    expect(map.objectives?.length).toBeGreaterThan(0);
    expect(map.doors?.length).toBeGreaterThan(0);
  });
});

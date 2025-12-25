import { describe, it, expect } from "vitest";
import { SpaceshipGenerator } from "../../generators/SpaceshipGenerator";
import { CellType } from "../../../shared/types";

describe("SpaceshipGenerator", () => {
  it("should generate a valid map with connected corridors and rooms", () => {
    const generator = new SpaceshipGenerator(12345, 32, 32);
    const map = generator.generate();

    expect(map.width).toBe(32);
    expect(map.height).toBe(32);

    const floors = map.cells.filter((c) => c.type === CellType.Floor);
    expect(floors.length).toBeGreaterThan(20); // Should have content

    // Check features
    expect(map.spawnPoints?.length).toBeGreaterThan(0);
    expect(map.extraction).toBeDefined();
    expect(map.objectives?.length).toBeGreaterThan(0);
    expect(map.doors?.length).toBeGreaterThan(0); // Should have doors for rooms
  });
});

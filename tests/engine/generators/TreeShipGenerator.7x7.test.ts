import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "@src/engine/MapGenerator";
import {
  calculateFillRate,
} from "@src/engine/tests/utils/GraphUtils";

describe("TreeShipGenerator 7x7", () => {
  it("should generate a 7x7 map (Seed 42) with sparse fill", async () => {
    const generator = new TreeShipGenerator(42, 7, 7);
    const map = generator.generate();

    const ascii = MapGenerator.toAscii(map);

    // Use golden file snapshot
    await expect(ascii).toMatchFileSnapshot(
      "./snapshots/TreeShipGenerator.7x7.txt",
    );

    // Verify properties
    expect(map.width).toBe(7);
    expect(map.height).toBe(7);

    // Verify fill rate (relaxed for claustrophobic design)
    expect(calculateFillRate(map)).toBeGreaterThanOrEqual(0.2);
  });
});

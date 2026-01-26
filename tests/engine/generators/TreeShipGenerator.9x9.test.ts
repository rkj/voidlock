import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "@src/engine/MapGenerator";
import {
  calculateFillRate,
} from "@src/engine/tests/utils/GraphUtils";

describe("TreeShipGenerator 9x9", () => {
  it("should generate a 9x9 map (Seed 42) with sparse fill", async () => {
    const generator = new TreeShipGenerator(42, 9, 9);
    const map = generator.generate();

    const ascii = MapGenerator.toAscii(map);

    // Use golden file snapshot
    await expect(ascii).toMatchFileSnapshot(
      "./snapshots/TreeShipGenerator.9x9.txt",
    );

    // Verify properties
    expect(map.width).toBe(9);
    expect(map.height).toBe(9);

    // Verify fill rate (relaxed for claustrophobic design)
    expect(calculateFillRate(map)).toBeGreaterThanOrEqual(0.2);
  });
});

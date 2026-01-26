import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import {
  calculateFillRate,
  checkConnectivity,
} from "@src/engine/tests/utils/GraphUtils";

describe("TreeShipGenerator Cycle Detection", () => {
  const numTests = 100;
  const startSeed = 123;
  const mapWidth = 15;
  const mapHeight = 15;

  for (let i = 0; i < numTests; i++) {
    const seed = startSeed + i;
    it(`should generate a ${mapWidth}x${mapHeight} map for seed ${seed} with valid fill rate and full connectivity`, () => {
      const generator = new TreeShipGenerator(seed, mapWidth, mapHeight);
      const map = generator.generate();

      const fillRate = calculateFillRate(map);
      expect(fillRate).toBeGreaterThanOrEqual(0.2);

      expect(checkConnectivity(map)).toBe(true);
    });
  }
});

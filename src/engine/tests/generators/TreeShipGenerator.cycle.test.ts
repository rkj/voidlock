import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "../../generators/TreeShipGenerator";
import { MapDefinition, CellType } from "../../../shared/types";
import {
  mapToAdjacencyList,
  hasCycleDFS,
  calculateFillRate,
  checkConnectivity,
} from "../utils/GraphUtils";

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
      // const adj = mapToAdjacencyList(map);
      // expect(hasCycleDFS(adj)).toBe(false); // Cycles allowed for rooms now

      const fillRate = calculateFillRate(map);
      expect(fillRate).toBeGreaterThanOrEqual(0.2);

      expect(checkConnectivity(map)).toBe(true);
    });
  }
});

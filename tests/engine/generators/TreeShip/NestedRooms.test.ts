import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { CellType, BoundaryType } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

describe("TreeShipGenerator Nested Rooms & Integrity", () => {
  it("should ensure all doors are placed within (no free-standing doors)", () => {
    for (let i = 0; i < 20; i++) {
      const generator = new TreeShipGenerator(i, 16, 16);
      const map = generator.generate();
      const graph = new Graph(map);

      if (map.doors) {
        for (const door of map.doors) {
          const [c1, c2] = door.segment;
          const boundary = graph.getBoundary(c1.x, c1.y, c2.x, c2.y);
          expect(boundary).toBeDefined();
          // The type property in Graph should be Door if it's a door
          expect(boundary?.type).toBe(BoundaryType.Door);
          expect(boundary?.doorId).toBe(door.id);
        }
      }
    }
  });
});

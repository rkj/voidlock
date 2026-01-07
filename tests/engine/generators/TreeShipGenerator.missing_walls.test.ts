import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { CellType } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

describe("TreeShipGenerator Missing Walls Repro", () => {
  it("should generate correct for Seed 1766029929040 on 12x12 map", () => {
    const generator = new TreeShipGenerator(1766029929040, 12, 12);
    const map = generator.generate();
    const graph = new Graph(map);

    const checkWallAgainstVoid = (
      x: number,
      y: number,
      dir: "n" | "e" | "s" | "w",
    ) => {
      const cell = graph.cells[y]?.[x];
      if (!cell || cell.type !== CellType.Floor) return;

      const nx = dir === "e" ? x + 1 : dir === "w" ? x - 1 : x;
      const ny = dir === "s" ? y + 1 : dir === "n" ? y - 1 : y;
      const neighbor = graph.cells[ny]?.[nx];

      if (!neighbor || neighbor.type === CellType.Void) {
        const b = cell.edges[dir];
        expect(
          b?.isWall,
          `Cell (${x},${y}) should have ${dir} wall against Void`,
        ).toBe(true);
      }
    };

    checkWallAgainstVoid(5, 3, "e");
    checkWallAgainstVoid(5, 11, "s");
    checkWallAgainstVoid(8, 3, "w");
    checkWallAgainstVoid(10, 5, "s");
  });
});

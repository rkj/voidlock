import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "../../generators/TreeShipGenerator";
import { MapGenerator } from "../../MapGenerator";
import { CellType } from "../../../shared/types";
import { Graph } from "../../Graph";
import * as fs from "fs";
import * as path from "path";

describe("TreeShipGenerator Repro Seed 1766029929040", () => {
  it("should generate fully open 2x2 rooms", () => {
    const seed = 1766029929040;
    const generator = new TreeShipGenerator(seed, 16, 16);
    const map = generator.generate();
    const graph = new Graph(map);

    const ascii = MapGenerator.toAscii(map);
    const snapshotPath = path.join(
      __dirname,
      "snapshots",
      "TreeShipGenerator.repro_x0f.16x16.golden.txt",
    );

    if (!fs.existsSync(path.dirname(snapshotPath))) {
      fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    }

    if (!fs.existsSync(snapshotPath)) {
      fs.writeFileSync(snapshotPath, ascii);
    } else {
      const expectedAscii = fs.readFileSync(snapshotPath, "utf8");
      expect(ascii).toBe(expectedAscii);
    }

    for (let y = 0; y < map.height - 1; y++) {
      for (let x = 0; x < map.width - 1; x++) {
        const c00 = graph.cells[y][x];
        const c10 = graph.cells[y][x + 1];
        const c01 = graph.cells[y + 1][x];
        const c11 = graph.cells[y + 1][x + 1];

        if (
          c00.type === CellType.Floor &&
          c10.type === CellType.Floor &&
          c01.type === CellType.Floor &&
          c11.type === CellType.Floor
        ) {
          const b_h1 = graph.getBoundary(x, y, x, y + 1);
          const b_h2 = graph.getBoundary(x + 1, y, x + 1, y + 1);
          const b_v1 = graph.getBoundary(x, y, x + 1, y);
          const b_v2 = graph.getBoundary(x, y + 1, x + 1, y + 1);

          const hasInternalWall =
            b_h1?.isWall || b_h2?.isWall || b_v1?.isWall || b_v2?.isWall;

          if (hasInternalWall) {
            const failedMapPath = path.join(
              __dirname,
              "snapshots",
              "TreeShipGenerator.repro_x0f.failed.txt",
            );
            fs.writeFileSync(failedMapPath, MapGenerator.toAscii(map));
            expect(
              hasInternalWall,
              `Found 2x2 block at ${x},${y} with internal walls! See ${failedMapPath}`,
            ).toBe(false);
          }
        }
      }
    }
  });
});

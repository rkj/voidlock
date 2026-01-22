import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "@src/engine/MapGenerator";
import * as fs from "fs";
import * as path from "path";

describe("TreeShipGenerator Golden Regression", () => {
  it("should match the golden map (JSON and ASCII) for seed 785411", () => {
    const seed = 785411;
    const width = 16;
    const height = 16;
    const generator = new TreeShipGenerator(seed, width, height);
    const generatedMap = generator.generate(4);

    // 1. JSON Comparison
    const jsonGoldenPath = path.join(
      __dirname,
      "../../../data/goldens/broken_map_golden.json",
    );
    if (fs.existsSync(jsonGoldenPath)) {
      const goldenData = JSON.parse(fs.readFileSync(jsonGoldenPath, "utf-8"));
      // Handle both raw MapDefinition and replayData wrapper
      const expectedMap = goldenData.replayData
        ? goldenData.replayData.map
        : goldenData;

      expect(generatedMap.width).toBe(expectedMap.width);
      expect(generatedMap.height).toBe(expectedMap.height);

      const sortCells = (cells: any[]) =>
        [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
      const sortWalls = (walls: any[]) =>
        [...walls].sort(
          (a, b) =>
            a.p1.x - b.p1.x ||
            a.p1.y - b.p1.y ||
            a.p2.x - b.p2.x ||
            a.p2.y - b.p2.y,
        );

      expect(sortCells(generatedMap.cells)).toEqual(
        sortCells(expectedMap.cells),
      );
      expect(sortWalls(generatedMap.walls || [])).toEqual(
        sortWalls(expectedMap.walls || []),
      );
    }

    // 2. ASCII Comparison
    const asciiGoldenPath = path.join(
      __dirname,
      "../../../data/goldens/broken_map_golden.txt",
    );
    const generatedAscii = MapGenerator.toAscii(generatedMap);

    // Write golden if missing (snapshot behavior)
    if (!fs.existsSync(asciiGoldenPath)) {
      fs.mkdirSync(path.dirname(asciiGoldenPath), { recursive: true });
      fs.writeFileSync(asciiGoldenPath, generatedAscii);
      console.log(`Created new golden file: ${asciiGoldenPath}`);
    }

    const expectedAscii = fs.readFileSync(asciiGoldenPath, "utf-8");
    expect(generatedAscii).toBe(expectedAscii);
  });
});

import { describe, it, expect } from "vitest";
import { MapGenerator } from "../../MapGenerator";
import { MapGeneratorType, Door } from "../../../shared/types";
import { LineOfSight } from "../../LineOfSight";
import { GameGrid } from "../../GameGrid";
import * as fs from "fs";
import * as path from "path";

describe("LOS Bug Repro - Seed 1766364915449", () => {
  it("should have LOS from 3,2 to 0,2 even if side doors are closed", () => {
    const seed = 1766364915449;
    const width = 6;
    const height = 6;

    const mapGen = new MapGenerator(seed);
    const mapDef = mapGen.generate(
      width,
      height,
      MapGeneratorType.DenseShip,
      1,
    );

    const ascii = MapGenerator.toAscii(mapDef);
    const snapshotDir = path.join(__dirname, "snapshots");
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    const snapshotPath = path.join(snapshotDir, "LOS_RealMap.golden.txt");

    if (!fs.existsSync(snapshotPath)) {
      fs.writeFileSync(snapshotPath, ascii);
    } else {
      const expectedAscii = fs.readFileSync(snapshotPath, "utf8");
      expect(ascii).toBe(expectedAscii);
    }

    // Setup GameGrid and Doors Map
    const grid = new GameGrid(mapDef);
    const doorsMap = new Map<string, Door>();
    mapDef.doors?.forEach((d) => {
      // Keep doors CLOSED.
      d.state = "Closed";
      doorsMap.set(d.id, d);
    });

    const los = new LineOfSight(grid.getGraph(), doorsMap);

    // Test LOS from 3,2 to 0,2
    const visible = los.computeVisibleCells({ x: 3, y: 2 }, 10);

    expect(visible).toContain("0,2");
  });
});

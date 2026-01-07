import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import { TreeShipGenerator } from "@src/engine/generators/TreeShipGenerator";
import { MapGenerator } from "@src/engine/MapGenerator";
import { CellType, BoundaryType } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

describe("TreeShipGenerator Nested Room Specific", () => {
  it("should match snapshots for seed 1766029929040", async () => {
    const seed = 1766029929040;
    const generator = new TreeShipGenerator(seed, 8, 8);
    const map = generator.generate();
    const graph = new Graph(map);

    const ascii = MapGenerator.toAscii(map);
    const json = JSON.stringify(map, null, 2);

    const jsonPath = path.join(__dirname, "NestedRoomsSpecific.map.json");
    fs.writeFileSync(jsonPath, json);

    await expect(ascii).toMatchFileSnapshot(
      "./snapshots/NestedRoomsSpecific.ascii.txt",
    );
    await expect(json).toMatchFileSnapshot(
      "./snapshots/NestedRoomsSpecific.json",
    );

    const nwX = 1;
    const nwY = 1;
    const nw00 = graph.cells[nwY][nwX];
    const nw10 = graph.cells[nwY][nwX + 1];
    const nw01 = graph.cells[nwY + 1][nwX];
    const nw11 = graph.cells[nwY + 1][nwX + 1];

    expect(nw00.type).toBe(CellType.Floor);
    expect(nw10.type).toBe(CellType.Floor);
    expect(nw01.type).toBe(CellType.Floor);
    expect(nw11.type).toBe(CellType.Floor);

    // Verify internal are open
    expect(graph.getBoundary(nwX, nwY, nwX + 1, nwY)?.type).toBe(BoundaryType.Open);
    expect(graph.getBoundary(nwX, nwY, nwX, nwY + 1)?.type).toBe(BoundaryType.Open);
    expect(graph.getBoundary(nwX + 1, nwY, nwX + 1, nwY + 1)?.type).toBe(
      BoundaryType.Open,
    );
    expect(graph.getBoundary(nwX, nwY + 1, nwX + 1, nwY + 1)?.type).toBe(
      BoundaryType.Open,
    );
  });
});

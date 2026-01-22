import { describe, it, expect } from "vitest";
import { MapGenerator } from "@src/engine/MapGenerator";
import { MapDefinition, CellType } from "@src/shared/types";
import { Graph } from "@src/engine/Graph";

describe("regression_voidlock_9bsw_sparse_json", () => {
  it("should omit Void cells from MapDefinition.cells after sanitize", () => {
    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ],
      walls: [{ p1: { x: 1, y: 0 }, p2: { x: 1, y: 1 } }], // Blocked
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    };

    MapGenerator.sanitize(map);

    // After fix, map.cells should only contain (0,0) because (1,0) became Void
    expect(map.cells.length).toBe(1);
    expect(map.cells[0].x).toBe(0);
    expect(map.cells[0].y).toBe(0);
    expect(map.cells[0].type).toBe(CellType.Floor);
  });

  it("should correctly load a sparse MapDefinition into Graph", () => {
    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        // (1,0) is missing, implicitly Void
      ],
      spawnPoints: [{ id: "sp1", pos: { x: 0, y: 0 }, radius: 1 }],
    };

    const graph = new Graph(map);

    expect(graph.cells[0][0].type).toBe(CellType.Floor);
    expect(graph.cells[0][1].type).toBe(CellType.Void);

    // Check if boundaries are correctly created even for sparse cells
    // Boundary between (0,0) and (1,0) should exist and be accessible from (0,0)
    expect(graph.cells[0][0].edges.e).toBeDefined();
    expect(graph.cells[0][0].edges.e?.x1).toBe(0);
    expect(graph.cells[0][0].edges.e?.x2).toBe(1);

    // Boundary between (0,0) and (1,0) should be accessible from (1,0) too if we fix Graph
    expect(graph.cells[0][1].edges.w).toBeDefined();
    expect(graph.cells[0][1].edges.w).toBe(graph.cells[0][0].edges.e);
  });
});

import { describe, it, expect } from "vitest";
import { MapGenerator } from "../../MapGenerator";
import { TileAssembly, TileDefinition, CellType } from "../../../shared/types";
import { SpaceHulkTiles } from "../../../content/tiles";
import { Graph } from "../../Graph";

describe("MapGenerator.assemble", () => {
  it("should assemble a single 1x1 corridor tile", () => {
    const assembly: TileAssembly = {
      tiles: [{ tileId: "corridor_1x1", x: 0, y: 0, rotation: 0 }],
    };

    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);
    const graph = new Graph(map);

    expect(map.width).toBe(1);
    expect(map.height).toBe(1);
    expect(map.cells[0].type).toBe(CellType.Floor);

    // 1x1 Corridor has Open North/South, Closed East/West
    const cell = graph.cells[0][0];
    expect(cell.edges.n?.isWall).toBe(true); // Border is wall
    expect(cell.edges.s?.isWall).toBe(true); // Border is wall
    // Wait, SpaceHulkTiles might have different definitions.
    // Let's check what's actually expected.
  });

  it("should assemble two connecting tiles", () => {
    const assembly: TileAssembly = {
      tiles: [
        { tileId: "corridor_1x1", x: 0, y: 0, rotation: 0 },
        { tileId: "corridor_1x1", x: 0, y: 1, rotation: 0 },
      ],
    };

    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);
    const graph = new Graph(map);

    expect(map.width).toBe(1);
    expect(map.height).toBe(2);

    const boundary = graph.getBoundary(0, 0, 0, 1);
    // Should be open if tiles connect
    expect(boundary?.isWall).toBe(false);
  });

  it("should assemble a larger room and handle internal walls", () => {
    const assembly: TileAssembly = {
      tiles: [{ tileId: "room_3x3", x: 0, y: 0, rotation: 0 }],
    };

    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);
    const graph = new Graph(map);
    expect(map.width).toBe(3);
    expect(map.height).toBe(3);

    // Center cell (1,1) should have all internal edges open
    const cell = graph.cells[1][1];
    expect(cell.edges.n?.isWall).toBe(false);
    expect(cell.edges.e?.isWall).toBe(false);
    expect(cell.edges.s?.isWall).toBe(false);
    expect(cell.edges.w?.isWall).toBe(false);
  });

  it("should normalize coordinates (handle negative placement)", () => {
    const assembly: TileAssembly = {
      tiles: [{ tileId: "corridor_1x1", x: -5, y: -5, rotation: 0 }],
    };
    const map = MapGenerator.assemble(assembly, SpaceHulkTiles);
    expect(map.width).toBe(1);
    expect(map.height).toBe(1);
    expect(map.cells[0].x).toBe(0);
    expect(map.cells[0].y).toBe(0);
  });

  it("should assemble a valid playable map", () => {
    const closedCorridor: TileDefinition = {
      id: "closed_corridor_1x3",
      width: 1,
      height: 3,
      cells: [
        { x: 0, y: 0, openEdges: ["s"] },
        { x: 0, y: 1, openEdges: ["n", "s"] },
        { x: 0, y: 2, openEdges: ["n"] },
      ],
    };
    const library = { ...SpaceHulkTiles, [closedCorridor.id]: closedCorridor };

    const assembly: TileAssembly = {
      tiles: [{ tileId: "closed_corridor_1x3", x: 0, y: 0, rotation: 0 }],
      globalSpawnPoints: [{ id: "sp1", cell: { x: 0, y: 0 } }],
      globalExtraction: { cell: { x: 0, y: 2 } },
      globalObjectives: [{ id: "obj1", kind: "Recover", cell: { x: 0, y: 2 } }],
    };

    const map = MapGenerator.assemble(assembly, library);
    const generator = new MapGenerator(123);
    const result = generator.validate(map);

    expect(
      result.isValid,
      `Validation Issues: ${result.issues.join(", ")}`,
    ).toBe(true);
  });
});

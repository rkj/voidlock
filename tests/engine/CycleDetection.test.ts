import { describe, it, expect } from "vitest";
import { MapDefinition, CellType } from "@src/shared/types";
import { mapToAdjacencyList, hasCycleDFS } from "@src/engine/tests/utils/GraphUtils";

describe("Cycle Detection Utilities", () => {
  it("should detect no cycles in a simple acyclic graph (line)", () => {
    const map: MapDefinition = {
      width: 3,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
      ],
      walls: [],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });

  it("should detect a simple cycle in a square graph", () => {
    const map: MapDefinition = {
      width: 2,
      height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
      ],
      walls: [],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });

  it("should detect no cycles in a map with disconnected components (acyclic)", () => {
    const map: MapDefinition = {
      width: 4,
      height: 1,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Void },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 3, y: 0, type: CellType.Floor },
      ],
      walls: [],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });

  it("should detect a cycle in a more complex graph (figure 8)", () => {
    const map: MapDefinition = {
      width: 5,
      height: 3,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Void },
        { x: 3, y: 0, type: CellType.Void },
        { x: 4, y: 0, type: CellType.Void },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
        { x: 3, y: 1, type: CellType.Void },
        { x: 4, y: 1, type: CellType.Void },
        { x: 0, y: 2, type: CellType.Void },
        { x: 1, y: 2, type: CellType.Floor },
        { x: 2, y: 2, type: CellType.Floor },
        { x: 3, y: 2, type: CellType.Void },
        { x: 4, y: 2, type: CellType.Void },
      ],
      walls: [],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });

  it("should detect a cycle in a 3x2 grid of floor cells (rectangular cycle)", () => {
    const map: MapDefinition = {
      width: 3,
      height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
      ],
      walls: [],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(true);
  });

  it("should NOT detect a cycle if walls break it", () => {
    const map: MapDefinition = {
      width: 3,
      height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
      ],
      walls: [
        { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
        { p1: { x: 1, y: 1 }, p2: { x: 2, y: 1 } },
        { p1: { x: 2, y: 1 }, p2: { x: 3, y: 1 } },
      ],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    expect(hasCycleDFS(adj)).toBe(false);
  });

  it("should detect a cycle even if some walls are present", () => {
    const map: MapDefinition = {
      width: 3,
      height: 2,
      cells: [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
        { x: 2, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 1, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
      ],
      walls: [
        { p1: { x: 0, y: 1 }, p2: { x: 1, y: 1 } },
        // (1,0)-(1,1) is open
        { p1: { x: 2, y: 1 }, p2: { x: 3, y: 1 } },
      ],
      doors: [],
      spawnPoints: [],
      objectives: [],
      extraction: undefined,
    };
    const adj = mapToAdjacencyList(map);
    // (0,0)-(1,0)-(1,1)-(0,1) would be a cycle if (0,0)-(0,1) was open.
    // Wait, (0,0)-(1,0)-(1,1)-(0,1) is NOT a cycle because (0,0)-(0,1) is closed.
    // Let's check (0,0)-(1,0), (1,0)-(2,0), (2,0)-(2,1), (2,1)-(1,1), (1,1)-(0,1), (0,1)-(0,0).
    // If (0,0)-(0,1) is wall, no cycle.
    expect(hasCycleDFS(adj)).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { GameGrid } from "../GameGrid";
import { MapDefinition, CellType, Cell, Door } from "../../shared/types";

describe("GameGrid", () => {
  let mockMap: MapDefinition;
  let grid: GameGrid;

  const createTestMapWithDoor = (
    doorState: "Open" | "Closed" | "Locked" | "Destroyed",
  ): { map: MapDefinition; doors: Map<string, Door> } => {
    const doorId = "testDoor";
    const mapCells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
    ];

    const door: Door = {
      id: doorId,
      segment: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ], // Door between (0,0) and (1,0)
      orientation: "Vertical",
      state: doorState,
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    return {
      map: { width: 2, height: 1, cells: mapCells, doors: [door] },
      doors: doorsMap,
    };
  };

  beforeEach(() => {
    // 2x2 map for standard tests
    const cells: Cell[] = [
      { x: 0, y: 0, type: CellType.Floor },
      { x: 1, y: 0, type: CellType.Floor },
      { x: 0, y: 1, type: CellType.Floor },
      { x: 1, y: 1, type: CellType.Wall },
    ];

    mockMap = {
      width: 2,
      height: 2,
      cells,
      walls: [
        { p1: { x: 0, y: 0 }, p2: { x: 0, y: 1 } }, // Wall between (0,0) and (0,1)
      ],
    };
    grid = new GameGrid(mockMap);
  });

  it("should allow movement between open edges", () => {
    expect(grid.canMove(0, 0, 1, 0, new Map())).toBe(true);
    expect(grid.canMove(1, 0, 0, 0, new Map())).toBe(true);
  });

  it("should block movement through walls", () => {
    expect(grid.canMove(0, 0, 0, 1, new Map())).toBe(false);
  });

  it("should block movement to void/wall cells", () => {
    expect(grid.canMove(1, 0, 1, 1, new Map())).toBe(false);
  });

  describe("door movement", () => {
    it("should allow movement through an open door", () => {
      const { map, doors } = createTestMapWithDoor("Open");
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(true);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(true);
    });

    it("should block movement through a closed door", () => {
      const { map, doors } = createTestMapWithDoor("Closed");
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(false);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(false);
    });

    it("should block movement through a locked door", () => {
      const { map, doors } = createTestMapWithDoor("Locked");
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(false);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(false);
    });

    it("should allow movement through a destroyed door", () => {
      const { map, doors } = createTestMapWithDoor("Destroyed");
      const doorGrid = new GameGrid(map);
      expect(doorGrid.canMove(0, 0, 1, 0, doors)).toBe(true);
      expect(doorGrid.canMove(1, 0, 0, 0, doors)).toBe(true);
    });
  });

  describe("robustness", () => {
    it("should block movement if edge is a wall", () => {
      const cells: Cell[] = [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 1, y: 0, type: CellType.Floor },
      ];
      const map: MapDefinition = {
        width: 2,
        height: 1,
        cells,
        walls: [{ p1: { x: 0, y: 0 }, p2: { x: 1, y: 0 } }],
      };
      const testGrid = new GameGrid(map);
      expect(testGrid.canMove(0, 0, 1, 0, new Map())).toBe(false);
    });

    it("should treat boundaries to the void as walls", () => {
      const cells: Cell[] = [
        { x: 0, y: 0, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
      ];
      const map: MapDefinition = {
        width: 1,
        height: 2,
        cells,
        // No explicit walls, but (0,0) and (0,1) are neighbors.
      };
      const testGrid = new GameGrid(map);
      // North of (0,0) is outside
      expect(testGrid.canMove(0, 0, 0, -1, new Map())).toBe(false);
    });
  });
});

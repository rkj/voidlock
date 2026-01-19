import { describe, it, expect } from "vitest";
import { LineOfSight } from "@src/engine/LineOfSight";
import { GameGrid } from "@src/engine/GameGrid";
import { MapDefinition, CellType, Door, Cell } from "@src/shared/types";

describe("LineOfFire Regression (15hj)", () => {
  it("should have LOS but NOT LOF through an opening door", () => {
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
      ],
      orientation: "Vertical",
      state: "Closed",
      targetState: "Open", // Door is opening
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: mapCells,
      doors: [door],
    };
    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    const grid = new GameGrid(map);
    const los = new LineOfSight(grid.getGraph(), doorsMap);

    const p1 = { x: 0.5, y: 0.5 };
    const p2 = { x: 1.5, y: 0.5 };

    // LOS should be allowed when opening (current behavior)
    expect(los.hasLineOfSight(p1, p2)).toBe(true);

    // LOF should be BLOCKED when opening
    expect(los.hasLineOfFire(p1, p2)).toBe(false);
  });

  it("should have both LOS and LOF through a fully open door", () => {
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
      ],
      orientation: "Vertical",
      state: "Open",
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: mapCells,
      doors: [door],
    };
    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    const grid = new GameGrid(map);
    const los = new LineOfSight(grid.getGraph(), doorsMap);

    const p1 = { x: 0.5, y: 0.5 };
    const p2 = { x: 1.5, y: 0.5 };

    expect(los.hasLineOfSight(p1, p2)).toBe(true);
    // LOF is blocked by door struts (outer 1/3) because UNIT_RADIUS (0.3) 
    // makes the "fat" ray (0.6 wide) wider than the opening (0.33 wide).
    expect(los.hasLineOfFire(p1, p2)).toBe(false);
  });

  it("should NOT have LOS or LOF through a closed door (not opening)", () => {
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
      ],
      orientation: "Vertical",
      state: "Closed",
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: mapCells,
      doors: [door],
    };
    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    const grid = new GameGrid(map);
    const los = new LineOfSight(grid.getGraph(), doorsMap);

    const p1 = { x: 0.5, y: 0.5 };
    const p2 = { x: 1.5, y: 0.5 };

    expect(los.hasLineOfSight(p1, p2)).toBe(false);
    expect(los.hasLineOfFire(p1, p2)).toBe(false);
  });

  it("should have LOS and LOF through a closing door (current behavior)", () => {
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
      ],
      orientation: "Vertical",
      state: "Open",
      targetState: "Closed", // Door is closing
      hp: 100,
      maxHp: 100,
      openDuration: 1,
    };

    const map: MapDefinition = {
      width: 2,
      height: 1,
      cells: mapCells,
      doors: [door],
    };
    const doorsMap = new Map<string, Door>();
    doorsMap.set(doorId, door);

    const grid = new GameGrid(map);
    const los = new LineOfSight(grid.getGraph(), doorsMap);

    const p1 = { x: 0.5, y: 0.5 };
    const p2 = { x: 1.5, y: 0.5 };

    // Currently allowed as state is still "Open"
    expect(los.hasLineOfSight(p1, p2)).toBe(true);
    // LOF is blocked by door struts (outer 1/3) because UNIT_RADIUS (0.3) 
    // makes the "fat" ray (0.6 wide) wider than the opening (0.33 wide).
    expect(los.hasLineOfFire(p1, p2)).toBe(false);
  });
});

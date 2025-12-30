import { describe, it, expect } from "vitest";
import { LineOfSight } from "../LineOfSight";
import { GameGrid } from "../GameGrid";
import { MapDefinition, CellType, Door, Cell } from "../../shared/types";

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
    // @ts-ignore - method doesn't exist yet
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
    // @ts-ignore
    expect(los.hasLineOfFire(p1, p2)).toBe(true);
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
    // @ts-ignore
    expect(los.hasLineOfFire(p1, p2)).toBe(false);
  });
});

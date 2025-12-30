import { describe, it, expect } from "vitest";
import { LineOfSight } from "./LineOfSight";
import { GameGrid } from "./GameGrid";
import { MapDefinition, CellType, Door, Cell } from "../shared/types";

describe("LineOfSight Early Visibility", () => {
  const createOpeningDoorMap = (): {
    map: MapDefinition;
    doors: Map<string, Door>;
  } => {
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
      targetState: "Open",
      openTimer: 500, // Still opening
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

  it("should have LOS through a door that is currently opening", () => {
    const { map, doors } = createOpeningDoorMap();
    const doorGrid = new GameGrid(map);
    const doorLos = new LineOfSight(doorGrid.getGraph(), doors);

    // This is expected to FAIL currently
    expect(doorLos.hasLineOfSight({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 })).toBe(
      true,
    );
  });
});

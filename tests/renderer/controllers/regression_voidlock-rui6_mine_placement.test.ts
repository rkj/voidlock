import { describe, it, expect } from "vitest";
import { TargetOverlayGenerator } from "@src/renderer/controllers/TargetOverlayGenerator";
import { RoomDiscoveryManager } from "@src/renderer/controllers/RoomDiscoveryManager";
import {
  GameState,
  CellType,
  BoundaryType,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Regression voidlock-rui6: Landmine Placement Rules", () => {
  const mockState: GameState = {
    t: 0,
    seed: 123,
    missionType: MissionType.Default,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, roomId: "corridor-1" },
        { x: 1, y: 0, type: CellType.Floor, roomId: "corridor-1" },
        { x: 2, y: 0, type: CellType.Floor, roomId: "corridor-1" },
        { x: 1, y: 1, type: CellType.Floor, roomId: "corridor-1" }, // T-junction at (1,0)
        { x: 5, y: 5, type: CellType.Floor, roomId: "room-1" },
      ],
      boundaries: [
        { x1: 0, y1: 0, x2: 1, y2: 0, type: BoundaryType.Open },
        { x1: 1, y1: 0, x2: 2, y2: 0, type: BoundaryType.Open },
        { x1: 1, y1: 0, x2: 1, y2: 1, type: BoundaryType.Open },
      ],
      spawnPoints: [],
    },
    units: [
      {
        id: "unit-1",
        pos: { x: 5.5, y: 5.5 }, // Inside room-1
        hp: 100,
        maxHp: 100,
        state: UnitState.Idle,
        stats: { speed: 30 } as any,
        commandQueue: [],
      } as any,
    ],
    enemies: [],
    visibleCells: ["0,0", "1,0", "2,0", "1,1", "5,5"],
    discoveredCells: ["0,0", "1,0", "2,0", "1,1", "5,5"],
    objectives: [],
    stats: {} as any,
    status: "Playing",
    settings: {} as any,
    squadInventory: { mine: 2 },
    loot: [],
    mines: [],
    turrets: [],
  };

  const discovery = new RoomDiscoveryManager();

  it("should only allow placement at intersections or current unit position", () => {
    const options = TargetOverlayGenerator.generate(
      "PLACEMENT_POINT",
      mockState,
      discovery,
    );

    // 1. (1,0) is a T-junction in corridor-1 (3 connections)
    // 2. (5,5) is the current position of unit-1

    expect(options.length).toBe(2);

    const posKeys = options.map((o) => `${o.pos.x},${o.pos.y}`);
    expect(posKeys).toContain("1,0");
    expect(posKeys).toContain("5,5");

    // (0,0), (2,0), (1,1) are corridor ends (1 connection), not intersections.
    expect(posKeys).not.toContain("0,0");
    expect(posKeys).not.toContain("2,0");
    expect(posKeys).not.toContain("1,1");
  });

  it("should NOT allow placement in open rooms if not unit position", () => {
    const stateWithRoomFloor = JSON.parse(JSON.stringify(mockState));
    stateWithRoomFloor.map.cells.push({
      x: 6,
      y: 5,
      type: CellType.Floor,
      roomId: "room-1",
    });
    stateWithRoomFloor.discoveredCells.push("6,5");

    const options = TargetOverlayGenerator.generate(
      "PLACEMENT_POINT",
      stateWithRoomFloor,
      discovery,
    );
    const posKeys = options.map((o) => `${o.pos.x},${o.pos.y}`);

    expect(posKeys).not.toContain("6,5");
  });
});

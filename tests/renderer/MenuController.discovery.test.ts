import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, CellType, MissionType } from "@src/shared/types";

describe("MenuController Room Discovery", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 1, y: 1, type: CellType.Floor, roomId: "room-1" },
        { x: 1, y: 2, type: CellType.Floor, roomId: "room-1" },
        { x: 5, y: 5, type: CellType.Floor, roomId: "room-2" },
        { x: 5, y: 6, type: CellType.Floor, roomId: "room-2" },
      ],
      boundaries: [],
    },
    units: [{ id: "u1", state: UnitState.Idle } as any],
    enemies: [],
    visibleCells: [],
    discoveredCells: ["1,1"], // Only room-1 is partially discovered
    objectives: [],
    loot: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      elitesKilled: 0,
      casualties: 0,
      scrapGained: 0,
    },
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      timeScale: 1,
      isPaused: false,
      isSlowMotion: false,
    },
    squadInventory: {},
  };

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should only show discovered rooms in MOVE target select with stable numbering", () => {
    // Select ORDERS (1) then MOVE TO ROOM (1)
    controller.handleMenuInput("1", mockState);
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");

    const renderState = controller.getRenderableState(mockState);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    // Should find Room 1 (mapped to Key 1) but not Room 2
    expect(roomOptions.length).toBe(1);
    expect(roomOptions[0].key).toBe("1");
    expect(roomOptions[0].label).toBe("1. Room");
  });

  it("should show discovered room as '1. Room' even if it wasn't the first room in map data", () => {
    const stateOnlyRoom2Discovered = {
      ...mockState,
      discoveredCells: ["5,5"], // Only room-2 is partially discovered
    };

    controller.handleMenuInput("1", stateOnlyRoom2Discovered);
    controller.handleMenuInput("1", stateOnlyRoom2Discovered);
    const renderState = controller.getRenderableState(stateOnlyRoom2Discovered);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    expect(roomOptions.length).toBe(1);
    expect(roomOptions[0].key).toBe("1");
    expect(roomOptions[0].label).toBe("1. Room");
  });

  it("should not list corridors as rooms", () => {
    const stateWithCorridor = {
      ...mockState,
      map: {
        ...mockState.map,
        cells: [
          ...mockState.map.cells,
          { x: 9, y: 9, type: CellType.Floor, roomId: "corridor-1" },
        ],
        boundaries: [],
      },
      discoveredCells: ["1,1", "5,5", "9,9"],
    };

    controller.handleMenuInput("1", stateWithCorridor);
    controller.handleMenuInput("1", stateWithCorridor);
    const renderState = controller.getRenderableState(stateWithCorridor);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    // Should still only have 2 rooms
    expect(roomOptions.length).toBe(2);
    expect(roomOptions.some((o) => o.label.includes("corridor"))).toBe(false);
  });

  it("should show both rooms if both are discovered, in discovery order", () => {
    const stateWithBothDiscovered = {
      ...mockState,
      discoveredCells: ["5,5", "1,1"], // 5,5 (room-2) first, 1,1 (room-1) second
    };

    controller.handleMenuInput("1", stateWithBothDiscovered);
    controller.handleMenuInput("1", stateWithBothDiscovered);
    const renderState = controller.getRenderableState(stateWithBothDiscovered);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    expect(roomOptions.length).toBe(2);
    expect(roomOptions[0].key).toBe("1");
    expect(roomOptions[0].label).toBe("1. Room");
    expect(roomOptions[1].key).toBe("2");
    expect(roomOptions[1].label).toBe("2. Room");
  });
});

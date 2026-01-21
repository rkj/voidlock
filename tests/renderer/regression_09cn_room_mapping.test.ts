import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, CellType, MissionType } from "@src/shared/types";

describe("MenuController Room Mapping Regression (09cn)", () => {
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
        { x: 1, y: 1, type: CellType.Floor, roomId: "room-A" },
        { x: 5, y: 5, type: CellType.Floor, roomId: "room-B" },
      ],
    },
    units: [{ id: "u1", state: UnitState.Idle } as any],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    loot: [],
    mines: [],
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
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: {},
  };

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
    // @ts-ignore - clearing discovery order if it existed
    if (controller.clearDiscoveryOrder) controller.clearDiscoveryOrder();
  });

  it("should map rooms to 1, 2, etc. based on discovery order", () => {
    const state1 = {
      ...mockState,
      discoveredCells: ["5,5"], // Room B discovered first
    };

    controller.handleMenuInput("1", state1); // Select ORDERS
    controller.handleMenuInput("1", state1); // Select MOVE TO ROOM
    let renderState = controller.getRenderableState(state1);
    let roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    expect(roomOptions.length).toBe(1);
    expect(roomOptions[0].key).toBe("1");
    expect(roomOptions[0].label).toBe("1. Room 1");

    const state2 = {
      ...state1,
      discoveredCells: ["5,5", "1,1"], // Room A discovered second
    };

    // Live update check
    renderState = controller.getRenderableState(state2);
    roomOptions = renderState.options.filter((o) => o.label.includes("Room"));

    expect(roomOptions.length).toBe(2);
    expect(roomOptions[0].key).toBe("1");
    expect(roomOptions[0].label).toBe("1. Room 1");
    expect(roomOptions[1].key).toBe("2");
    expect(roomOptions[1].label).toBe("2. Room 2");
  });

  it("should use A-Z after 1-9", () => {
    const manyRoomsState: GameState = {
      ...mockState,
      map: {
        ...mockState.map,
        cells: [],
      },
      discoveredCells: [],
    };

    for (let i = 0; i < 15; i++) {
      const roomId = `room-${i}`;
      manyRoomsState.map.cells.push({
        x: i,
        y: 0,
        type: CellType.Floor,
        roomId,
      });
      manyRoomsState.discoveredCells.push(`${i},0`);
    }

    controller.handleMenuInput("1", manyRoomsState); // Select ORDERS
    controller.handleMenuInput("1", manyRoomsState); // Select MOVE TO ROOM
    const renderState = controller.getRenderableState(manyRoomsState);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    expect(roomOptions.length).toBe(15);
    expect(roomOptions[0].key).toBe("1");
    expect(roomOptions[8].key).toBe("9");
    expect(roomOptions[9].key).toBe("A");
    expect(roomOptions[10].key).toBe("B");
    expect(roomOptions[14].key).toBe("F");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "./MenuController";
import {
  GameState,
  UnitState,
  CellType,
} from "../shared/types";

describe("MenuController Room Discovery", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 1, y: 1, type: CellType.Floor, roomId: "room-1" },
        { x: 1, y: 2, type: CellType.Floor, roomId: "room-1" },
        { x: 5, y: 5, type: CellType.Floor, roomId: "room-2" },
        { x: 5, y: 6, type: CellType.Floor, roomId: "room-2" },
      ],
    },
    units: [{ id: "u1", state: UnitState.Idle } as any],
    enemies: [],
    visibleCells: [],
    discoveredCells: ["1,1"], // Only room-1 is partially discovered
    objectives: [],
    threatLevel: 0,
    aliensKilled: 0,
    casualties: 0,
    status: "Playing",
    debugOverlayEnabled: false,
    losOverlayEnabled: false,
    timeScale: 1,
    isPaused: false,
    isSlowMotion: false,
  };

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should only show discovered rooms in MOVE target select with stable numbering", () => {
    // Select MOVE (1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");

    const renderState = controller.getRenderableState(mockState);
    const roomOptions = renderState.options.filter(o => o.label.includes("Room"));

    // Should find Room 1 but not Room 2
    expect(roomOptions.length).toBe(1);
    expect(roomOptions[0].label).toContain("Room 1");
  });

  it("should show Room 2 as 'Room 2' even if Room 1 is NOT discovered", () => {
    const stateOnlyRoom2Discovered = {
        ...mockState,
        discoveredCells: ["5,5"] // Only room-2 is partially discovered
    };

    controller.handleMenuInput("1", stateOnlyRoom2Discovered);
    const renderState = controller.getRenderableState(stateOnlyRoom2Discovered);
    const roomOptions = renderState.options.filter(o => o.label.includes("Room"));

    expect(roomOptions.length).toBe(1);
    expect(roomOptions[0].label).toContain("Room 2");
  });

  it("should not list corridors as rooms", () => {
    const stateWithCorridor = {
        ...mockState,
        map: {
            ...mockState.map,
            cells: [
                ...mockState.map.cells,
                { x: 9, y: 9, type: CellType.Floor, roomId: "corridor-1" }
            ]
        },
        discoveredCells: ["1,1", "5,5", "9,9"]
    };

    controller.handleMenuInput("1", stateWithCorridor);
    const renderState = controller.getRenderableState(stateWithCorridor);
    const roomOptions = renderState.options.filter(o => o.label.includes("Room"));

    // Should still only have 2 rooms
    expect(roomOptions.length).toBe(2);
    expect(roomOptions.some(o => o.label.includes("corridor"))).toBe(false);
  });

  it("should show both rooms if both are discovered", () => {
    const stateWithBothDiscovered = {
        ...mockState,
        discoveredCells: ["1,1", "5,5"]
    };

    controller.handleMenuInput("1", stateWithBothDiscovered);
    const renderState = controller.getRenderableState(stateWithBothDiscovered);
    const roomOptions = renderState.options.filter(o => o.label.includes("Room"));

    expect(roomOptions.length).toBe(2);
    expect(roomOptions.some(o => o.label.includes("Room 1"))).toBe(true);
    expect(roomOptions.some(o => o.label.includes("Room 2"))).toBe(true);
  });
});
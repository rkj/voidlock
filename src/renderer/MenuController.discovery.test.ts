import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "./MenuController";
import { GameState, UnitState, CellType } from "../shared/types";

describe("MenuController - Room Discovery", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: CellType.Floor, roomId: "RoomA" },
        { x: 5, y: 5, type: CellType.Floor, roomId: "RoomB" },
      ],
    },
    units: [{ id: "u1", state: UnitState.Idle } as any],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    threatLevel: 0,
    aliensKilled: 0,
    casualties: 0,
    status: "Playing",
  };

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should list only discovered rooms in MOVE target select", () => {
    const gameState: GameState = {
      ...mockState,
      discoveredCells: ["0,0"], // Only RoomA discovered
    };

    controller.handleMenuInput("1", gameState); // Select MOVE
    expect(controller.menuState).toBe("TARGET_SELECT");

    const renderState = controller.getRenderableState(gameState);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    // CURRENT BEHAVIOR (before fix): might list both or use original roomId
    // We expect it to only list RoomA.
    expect(roomOptions.length).toBe(1);
    expect(roomOptions[0].label).toMatch(/Room 1/);
  });

  it("should use linear numbering without gaps", () => {
    const gameState: GameState = {
      ...mockState,
      discoveredCells: ["5,5"], // Only RoomB discovered
    };

    controller.handleMenuInput("1", gameState); // Select MOVE
    const renderState = controller.getRenderableState(gameState);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    expect(roomOptions.length).toBe(1);
    // Even though it's the second room in the map, it's the first discovered,
    // so it should be "Room 1" to avoid revealing there was another room.
    expect(roomOptions[0].label).toContain("Room 1");
  });
});

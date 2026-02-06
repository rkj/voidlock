import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, CellType, MissionType } from "@src/shared/types";

describe("MenuController Room Discovery Repro", () => {
  let controller: MenuController;
  let mockClient: any;
  const fullMapState: GameState = {
    t: 0,
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
    units: [{ id: "u1", state: UnitState.Idle, pos: { x: 1, y: 1 } } as any],
    enemies: [],
    visibleCells: ["1,1"],
    discoveredCells: ["1,1"],
    objectives: [],
    loot: [],
    mines: [],
    turrets: [],
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
      debugOverlayEnabled: false, debugSnapshots: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: {},
  };

  const optimizedState: GameState = {
    ...fullMapState,
    t: 1000,
    discoveredCells: ["1,1", "5,5"],
    map: {
      ...fullMapState.map,
      cells: [], // Optimized: cells are omitted after first send
    },
  };

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should succeed to show rooms if cells are optimized away but update was called once", () => {
    // 1. First update HAS cells - simulate GameApp.updateUI
    controller.update(fullMapState);

    // 2. Second update HAS NO cells
    controller.handleMenuInput("1", optimizedState); // Orders
    controller.handleMenuInput("1", optimizedState); // Move to Room

    expect(controller.menuState).toBe("TARGET_SELECT");

    const renderState = controller.getRenderableState(optimizedState);
    const roomOptions = renderState.options.filter((o) =>
      o.label.includes("Room"),
    );

    // This should now PASS
    expect(roomOptions.length).toBe(2);
    expect(roomOptions[0].label).toBe("1. Room 1");
    expect(roomOptions[1].label).toBe("2. Room 2");
  });
});

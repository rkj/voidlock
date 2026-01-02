import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "./MenuController";
import { GameState, UnitState, CellType } from "../shared/types";

describe("MenuController Intersection Discovery", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 1, y: 1, type: CellType.Floor }, // Intersection
        { x: 1, y: 0, type: CellType.Floor },
        { x: 1, y: 2, type: CellType.Floor },
        { x: 0, y: 1, type: CellType.Floor },
        { x: 2, y: 1, type: CellType.Floor },
      ],
      boundaries: [
        { x1: 1, y1: 1, x2: 1, y2: 0, isWall: false },
        { x1: 1, y1: 1, x2: 1, y2: 2, isWall: false },
        { x1: 1, y1: 1, x2: 0, y2: 1, isWall: false },
        { x1: 1, y1: 1, x2: 2, y2: 1, isWall: false },
      ],
    },
    units: [{ id: "u1", state: UnitState.Idle } as any],
    enemies: [],
    visibleCells: [],
    discoveredCells: ["1,1"],
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
    mockClient = { sendCommand: vi.fn() };
    controller = new MenuController(mockClient);
  });

  it("should find intersections in target select for OVERWATCH", () => {
    // Select ORDERS (1) then OVERWATCH INTERSECTION (2)
    controller.handleMenuInput("1", mockState);
    controller.handleMenuInput("2", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");

    const renderState = controller.getRenderableState(mockState);
    const intersectionOptions = controller.overlayOptions.filter((o) =>
      o.label.includes("Intersection"),
    );

    expect(intersectionOptions.length).toBe(1);
    expect(intersectionOptions[0].key).toBe("1");
    expect(intersectionOptions[0].pos).toEqual({ x: 1, y: 1 });
  });
});

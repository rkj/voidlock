import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, MissionType } from "@src/shared/types";

describe("MenuController Rehydration - Overwatch", () => {
  let controller: MenuController;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should rehydrate map state and find intersections for OVERWATCH_POINT", () => {
    // 1. Initial full state with an intersection
    const fullState: GameState = {
      t: 0,
      seed: 123,
      missionType: MissionType.Default,
      map: {
        width: 10,
        height: 10,
        cells: [
          // Intersection at 1,1 (neighbors at 0,1, 2,1, 1,0, 1,2)
          { x: 1, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 0, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 2, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 1, y: 0, type: "Floor" as any, roomId: "corridor" },
          { x: 1, y: 2, type: "Floor" as any, roomId: "corridor" },
        ],
        boundaries: [
          { x1: 1, y1: 1, x2: 0, y2: 1, type: "Open" as any },
          { x1: 1, y1: 1, x2: 2, y2: 1, type: "Open" as any },
          { x1: 1, y1: 1, x2: 1, y2: 0, type: "Open" as any },
          { x1: 1, y1: 1, x2: 1, y2: 2, type: "Open" as any },
        ],
        walls: [],
        spawnPoints: [],
        doors: [],
      },
      units: [],
      enemies: [],
      // Need visible cells to detect intersection? Usually TargetOverlayGenerator checks visibility.
      visibleCells: ["1,1", "0,1", "2,1", "1,0", "1,2"],
      discoveredCells: ["1,1", "0,1", "2,1", "1,0", "1,2"],
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
      settings: {} as any,
      squadInventory: {},
    };

    // Update controller to cache map
    controller.update(fullState);

    // 2. Stripped state
    const strippedState: GameState = {
      ...fullState,
      t: 100,
      map: {
        ...fullState.map,
        cells: [], // Stripped
      },
    };

    // 3. Select Overwatch
    controller.handleMenuInput("1", strippedState); // Orders
    // Need to find key for Overwatch. Usually 2 or 3.
    // Let's assume it's there.
    const ordersState = controller.getRenderableState(strippedState);
    const overwatchOption = ordersState.options.find((o) =>
      o.label.includes("Overwatch"),
    );
    expect(overwatchOption).toBeDefined();

    controller.handleMenuInput(overwatchOption!.key, strippedState);

    // 4. Verify options
    const renderState = controller.getRenderableState(strippedState);

    // Should have options (intersections)
    // If not rehydrated, map.cells is empty, so no intersections found.
    expect(renderState.error).toBeUndefined();
    expect(renderState.options.length).toBeGreaterThan(1); // At least Back + 1 intersection
  });
});

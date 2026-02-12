import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, MissionType, BoundaryType } from "@src/shared/types";

describe("Regression - Overwatch Intersections with Doors", () => {
  let controller: MenuController;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should find intersections that include doors", () => {
    const fullState: GameState = {
      t: 0,
      seed: 123,
      missionType: MissionType.Default,
      map: {
        width: 10,
        height: 10,
        cells: [
          { x: 1, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 0, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 2, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 1, y: 0, type: "Floor" as any, roomId: "corridor" },
        ],
        boundaries: [
          { x1: 1, y1: 1, x2: 0, y2: 1, type: BoundaryType.Open },
          { x1: 1, y1: 1, x2: 2, y2: 1, type: BoundaryType.Door }, // DOOR!
          { x1: 1, y1: 1, x2: 1, y2: 0, type: BoundaryType.Open },
        ],
        walls: [],
        spawnPoints: [],
        doors: [],
      },
      units: [],
      enemies: [],
      visibleCells: ["1,1", "0,1", "2,1", "1,0"],
      discoveredCells: ["1,1", "0,1", "2,1", "1,0"],
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

    controller.update(fullState);

    // Select Overwatch
    controller.handleMenuInput("1", fullState); // Orders
    const ordersState = controller.getRenderableState(fullState);
    const overwatchOption = ordersState.options.find((o) =>
      o.label.includes("OVERWATCH"),
    );
    expect(overwatchOption).toBeDefined();

    controller.handleMenuInput(overwatchOption!.key, fullState);

    const renderState = controller.getRenderableState(fullState);

    // This is expected to FAIL currently because it only counts Open boundaries
    expect(renderState.error).toBeUndefined();
    expect(renderState.options.length).toBeGreaterThan(1);
  });

  it("should find dead ends (1 connection)", () => {
    const fullState: GameState = {
      t: 0,
      seed: 123,
      missionType: MissionType.Default,
      map: {
        width: 10,
        height: 10,
        cells: [
          { x: 1, y: 1, type: "Floor" as any, roomId: "corridor" },
          { x: 0, y: 1, type: "Floor" as any, roomId: "corridor" },
        ],
        boundaries: [{ x1: 1, y1: 1, x2: 0, y2: 1, type: BoundaryType.Open }],
        walls: [],
        spawnPoints: [],
        doors: [],
      },
      units: [],
      enemies: [],
      visibleCells: ["1,1", "0,1"],
      discoveredCells: ["1,1", "0,1"],
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

    controller.update(fullState);

    // Select Overwatch
    controller.handleMenuInput("1", fullState); // Orders
    const ordersState = controller.getRenderableState(fullState);
    const overwatchOption = ordersState.options.find((o) =>
      o.label.includes("OVERWATCH"),
    );
    controller.handleMenuInput(overwatchOption!.key, fullState);

    const renderState = controller.getRenderableState(fullState);

    // This is expected to FAIL currently because it only checks for >= 3 connections
    expect(renderState.error).toBeUndefined();
    expect(renderState.options.length).toBeGreaterThan(1);
  });
});

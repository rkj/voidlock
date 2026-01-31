import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, MissionType } from "@src/shared/types";

describe("MenuController Rehydration", () => {
  let controller: MenuController;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should rehydrate map state when generating overlays in getRenderableState", () => {
    // 1. Initial full state
    const fullState: GameState = {
      t: 0,
      seed: 123,
      missionType: MissionType.Default,
      map: {
        width: 10,
        height: 10,
        cells: [{ x: 0, y: 0, type: "Floor" as any, roomId: "room-1" }],
        walls: [],
        spawnPoints: [],
        doors: [],
      },
      units: [],
      enemies: [],
      visibleCells: ["0,0"],
      discoveredCells: ["0,0"],
      objectives: [],
      loot: [],
      mines: [], turrets: [],
      stats: { threatLevel: 0, aliensKilled: 0, elitesKilled: 0, casualties: 0, scrapGained: 0 },
      status: "Playing",
      settings: {} as any,
      squadInventory: {},
    };

    // Update controller with full state to cache it
    controller.update(fullState);

    // 2. Stripped state (cells missing)
    const strippedState: GameState = {
      ...fullState,
      t: 100,
      map: {
        ...fullState.map,
        cells: [], // Stripped!
      },
    };

    // Transition to TARGET_SELECT (Move)
    controller.handleMenuInput("1", strippedState); // Orders
    controller.handleMenuInput("1", strippedState); // Move

    // 3. Call getRenderableState with stripped state
    const renderState = controller.getRenderableState(strippedState);

    // It should have options because it rehydrated the map
    expect(renderState.options.length).toBeGreaterThan(1); // At least one option + Back
    // Option for 0,0 should exist
    const roomOption = renderState.options.find(o => o.label.includes("Room 1"));
    expect(roomOption).toBeDefined();
  });
});

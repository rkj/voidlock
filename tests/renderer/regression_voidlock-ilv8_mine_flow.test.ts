import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  CommandType,
  GameState,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Regression voidlock-ilv8 - Landmine Flow", () => {
  let controller: MenuController;
  let mockClient: any;
  let mockState: GameState;

  beforeEach(() => {
    mockState = {
      t: 1000,
      seed: 12345,
      missionType: MissionType.Default,
      map: {
        width: 10,
        height: 10,
        cells: [
          { x: 5, y: 5, type: "Floor", roomId: "corridor-1" } as any,
          { x: 4, y: 5, type: "Floor", roomId: "corridor-1" } as any,
          { x: 6, y: 5, type: "Floor", roomId: "corridor-1" } as any,
          { x: 5, y: 4, type: "Floor", roomId: "corridor-1" } as any,
        ],
        boundaries: [
          { x1: 5, y1: 5, x2: 4, y2: 5, type: "Open" } as any,
          { x1: 5, y1: 5, x2: 6, y2: 5, type: "Open" } as any,
          { x1: 5, y1: 5, x2: 5, y2: 4, type: "Open" } as any,
        ],
      },
      units: [
        {
          id: "u1",
          pos: { x: 8.5, y: 8.5 },
          state: UnitState.Idle,
          hp: 100,
          maxHp: 100,
        } as any,
        {
          id: "u2",
          pos: { x: 9.5, y: 8.5 },
          state: UnitState.Idle,
          hp: 100,
          maxHp: 100,
        } as any,
      ],
      enemies: [],
      visibleCells: ["5,5", "8,8", "9,8"],
      discoveredCells: ["5,5", "8,8", "9,8"],
      objectives: [],
      loot: [],
      mines: [], turrets: [],
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
      squadInventory: {
        mine: 1,
      },
    };
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should follow the sequence: Item -> Unit -> Target for Landmine", () => {
    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);
    expect(controller.menuState).toBe("ITEM_SELECT");

    // 2. Item Select -> Landmine (1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("UNIT_SELECT");
    expect(controller.pendingItemId).toBe("mine");

    // 3. Unit Select -> Unit 1 (1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");
    expect(controller.pendingUnitIds).toEqual(["u1"]);

    // 4. Target Select -> Room 1 (1)
    controller.handleMenuInput("1", mockState);
    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "mine",
        unitIds: ["u1"],
        target: { x: 5, y: 5 },
      }),
    );
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should support 'ALL UNITS' in the sequence for Landmine", () => {
    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);

    // 2. Item Select -> Landmine (1)
    controller.handleMenuInput("1", mockState);

    // 3. Unit Select -> ALL UNITS (3)
    controller.handleMenuInput("3", mockState);
    expect(controller.menuState).toBe("TARGET_SELECT");
    expect(controller.pendingUnitIds).toEqual(["u1", "u2"]);

    // 4. Target Select -> Room 1 (1)
    controller.handleMenuInput("1", mockState);
    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "mine",
        unitIds: ["u1", "u2"],
        target: { x: 5, y: 5 },
      }),
    );
  });

  it("should allow canvas click for Target after selecting Unit for Landmine", () => {
    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);

    // 2. Item Select -> Landmine (1)
    controller.handleMenuInput("1", mockState);

    // 3. Unit Select -> Unit 1 (1)
    controller.handleMenuInput("1", mockState);

    // 4. Canvas Click on (5,5)
    controller.handleCanvasClick({ x: 5, y: 5 }, mockState);

    expect(mockClient.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CommandType.USE_ITEM,
        itemId: "mine",
        unitIds: ["u1"],
        target: { x: 5, y: 5 },
      }),
    );
  });

  it("should handle goBack correctly in the sequence", () => {
    // Action -> Item -> Unit -> Target
    controller.handleMenuInput("3", mockState); // Item Select
    controller.handleMenuInput("1", mockState); // Unit Select
    expect(controller.menuState).toBe("UNIT_SELECT");

    controller.goBack();
    expect(controller.menuState).toBe("ITEM_SELECT");

    controller.handleMenuInput("1", mockState); // Back to Unit Select
    controller.handleMenuInput("1", mockState); // Target Select
    expect(controller.menuState).toBe("TARGET_SELECT");

    controller.goBack();
    expect(controller.menuState).toBe("UNIT_SELECT");
    expect(controller.pendingUnitIds).toBeNull();
  });
});

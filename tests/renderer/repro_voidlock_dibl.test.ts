import { describe, it, expect, beforeEach, vi } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  GameState,
  CommandType,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("MenuController Repro voidlock-dibl", () => {
  let menuController: MenuController;
  let mockClient: { applyCommand: any };

  beforeEach(() => {
    mockClient = { applyCommand: vi.fn() };
    menuController = new MenuController(mockClient);
  });

  it("should maintain pending state if just switching HUD selection (Current Behavior)", () => {
    const gameState: GameState = {
      t: 0,
      seed: 123,
      status: "Playing",
      units: [
        {
          id: "unit1",
          pos: { x: 1, y: 1 },
          hp: 10,
          maxHp: 10,
          stats: { speed: 100, soldierAim: 50 },
          state: UnitState.Idle,
          commandQueue: [],
        },
        {
          id: "unit2",
          pos: { x: 2, y: 2 },
          hp: 10,
          maxHp: 10,
          stats: { speed: 100, soldierAim: 50 },
          state: UnitState.Idle,
          commandQueue: [],
        },
      ],
      enemies: [],
      map: { width: 10, height: 10, cells: [] },
      squadInventory: {},
      stats: { aliensKilled: 0, casualties: 0 },
      settings: {
        isPaused: false,
        timeScale: 1,
        allowTacticalPause: true,
        debugOverlayEnabled: false, debugSnapshots: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
      },
      objectives: [],
      missionType: MissionType.Default,
      visibleCells: [],
      discoveredRooms: [],
    } as any;

    // Start a MOVE_TO flow
    menuController.handleMenuInput("1", gameState); // Orders
    menuController.handleMenuInput("1", gameState); // Move to Room

    expect(menuController.menuState).toBe("TARGET_SELECT");
    expect(menuController.pendingAction).toBe(CommandType.MOVE_TO);

    // Go back to ACTION_SELECT
    menuController.handleMenuInput("0", gameState); // Back to ORDERS_SELECT
    menuController.handleMenuInput("0", gameState); // Back to ACTION_SELECT

    expect(menuController.menuState).toBe("ACTION_SELECT");
    expect(menuController.pendingAction).toBeNull();
  });

  it("should clear everything when starting a new action flow from ACTION_SELECT", () => {
    const gameState: GameState = {
      t: 0,
      seed: 123,
      status: "Playing",
      units: [
        {
          id: "unit1",
          pos: { x: 1, y: 1 },
          hp: 10,
          maxHp: 10,
          stats: { speed: 100, soldierAim: 50 },
          state: UnitState.Idle,
          commandQueue: [],
        },
      ],
      enemies: [],
      map: { width: 10, height: 10, cells: [] },
      squadInventory: { medkit: 1 },
      stats: { aliensKilled: 0, casualties: 0 },
      settings: {
        isPaused: false,
        timeScale: 1,
        allowTacticalPause: true,
        debugOverlayEnabled: false, debugSnapshots: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
      },
      objectives: [],
      missionType: MissionType.Default,
      visibleCells: [],
      discoveredRooms: [],
    } as any;

    // 1. Start MOVE_TO flow and pick a target
    menuController.handleMenuInput("1", gameState); // Orders
    menuController.handleMenuInput("1", gameState); // Move to Room
    menuController.handleCanvasClick({ x: 5, y: 5 }, gameState); // Pick target, transitions to UNIT_SELECT

    expect(menuController.menuState).toBe("UNIT_SELECT");
    expect(menuController.pendingTargetLocation).toEqual({ x: 5, y: 5 });

    // 2. Go back to ACTION_SELECT manually (simulate changing mind)
    menuController.goBack(); // Back to TARGET_SELECT
    menuController.goBack(); // Back to ORDERS_SELECT
    menuController.goBack(); // Back to ACTION_SELECT

    expect(menuController.menuState).toBe("ACTION_SELECT");
    expect(menuController.pendingTargetLocation).toBeNull(); // Should be cleared by reset() in goBack()
  });

  it("should reset menu controller when reset() is called externally (simulating HUD unit change)", () => {
    const gameState: GameState = {
      t: 0,
      seed: 123,
      status: "Playing",
      units: [
        {
          id: "unit1",
          pos: { x: 1, y: 1 },
          hp: 10,
          maxHp: 10,
          stats: { speed: 100, soldierAim: 50 },
          state: UnitState.Idle,
          commandQueue: [],
        },
      ],
      enemies: [],
      map: { width: 10, height: 10, cells: [] },
      squadInventory: {},
      stats: { aliensKilled: 0, casualties: 0 },
      settings: {
        isPaused: false,
        timeScale: 1,
        allowTacticalPause: true,
        debugOverlayEnabled: false, debugSnapshots: false,
        losOverlayEnabled: false,
        agentControlEnabled: true,
      },
      objectives: [],
      missionType: MissionType.Default,
      visibleCells: [],
      discoveredRooms: [],
    } as any;

    // 1. Start MOVE_TO flow and pick a target
    menuController.handleMenuInput("1", gameState); // Orders
    menuController.handleMenuInput("1", gameState); // Move to Room
    menuController.handleCanvasClick({ x: 5, y: 5 }, gameState); // Pick target, transitions to UNIT_SELECT

    expect(menuController.menuState).toBe("UNIT_SELECT");

    // 2. Simulate HUD unit selection change
    menuController.reset();

    expect(menuController.menuState).toBe("ACTION_SELECT");
    expect(menuController.pendingAction).toBeNull();
    expect(menuController.pendingTargetLocation).toBeNull();
  });
});

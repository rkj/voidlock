import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  CommandType,
  GameState,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("MenuController State Machine Refactor (n0xw)", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: { width: 10, height: 10, cells: [] },
    units: [
      { id: "u1", pos: { x: 0.5, y: 0.5 }, state: UnitState.Idle } as any,
    ],
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
    squadInventory: { "medkit": 1, "mine": 1 },
  };

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should return to ORDERS_SELECT from TARGET_SELECT if it was the parent", () => {
    controller.handleMenuInput("1", mockState); // ORDERS
    expect(controller.menuState).toBe("ORDERS_SELECT");
    controller.handleMenuInput("1", mockState); // MOVE TO ROOM
    expect(controller.menuState).toBe("TARGET_SELECT");
    
    controller.goBack();
    expect(controller.menuState).toBe("ORDERS_SELECT");
  });

  it("should return to ITEM_SELECT from TARGET_SELECT if it was the parent", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    expect(controller.menuState).toBe("ITEM_SELECT");
    // Assuming medkit is the first item
    controller.handleMenuInput("1", mockState); // Select Medkit
    expect(controller.menuState).toBe("TARGET_SELECT");
    
    controller.goBack();
    expect(controller.menuState).toBe("ITEM_SELECT");
  });

  it("should return to ACTION_SELECT from TARGET_SELECT if it was the parent (PICKUP)", () => {
    controller.handleMenuInput("4", mockState); // PICKUP
    expect(controller.menuState).toBe("TARGET_SELECT");
    
    controller.goBack();
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should return to MODE_SELECT from UNIT_SELECT if it was the parent", () => {
    controller.handleMenuInput("2", mockState); // ENGAGEMENT
    expect(controller.menuState).toBe("MODE_SELECT");
    controller.handleMenuInput("1", mockState); // ENGAGE
    expect(controller.menuState).toBe("UNIT_SELECT");
    
    controller.goBack();
    expect(controller.menuState).toBe("MODE_SELECT");
  });
  
  it("should reset completely when going back from Level 1 menus", () => {
    controller.handleMenuInput("1", mockState); // ORDERS
    expect(controller.menuState).toBe("ORDERS_SELECT");
    controller.goBack();
    expect(controller.menuState).toBe("ACTION_SELECT");
    expect(controller.pendingAction).toBeNull();
  });

  it("should execute and reset when a healing item target is selected", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("1", mockState); // Select Medkit
    expect(controller.menuState).toBe("TARGET_SELECT");
    
    // Simulate clicking a unit in Target Select
    // In our mockState, u1 is at (0.5, 0.5)
    controller.handleCanvasClick({ x: 0, y: 0 }, mockState);
    
    expect(mockClient.sendCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: CommandType.USE_ITEM,
      itemId: "medkit",
    }));
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should return to UNIT_SELECT from TARGET_SELECT in landmine flow", () => {
    controller.handleMenuInput("3", mockState); // USE ITEM
    controller.handleMenuInput("2", mockState); // Select Landmine (assuming it's 2nd)
    expect(controller.menuState).toBe("UNIT_SELECT");
    
    controller.handleMenuInput("1", mockState); // Select Unit 1
    expect(controller.menuState).toBe("TARGET_SELECT");
    
    controller.goBack();
    expect(controller.menuState).toBe("UNIT_SELECT");
    expect(controller.pendingUnitIds).toBeNull();
    
    controller.goBack();
    expect(controller.menuState).toBe("ITEM_SELECT");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import {
  GameState,
  UnitState,
  MissionType,
} from "@src/shared/types";

describe("Regression v7xe: Friendly Names in Command Menu", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    seed: 12345,
    missionType: MissionType.Default,
    map: {
      width: 10,
      height: 10,
      cells: [
        { x: 0, y: 0, type: "Floor", roomId: "room_1" },
      ] as any,
    },
    units: [
      {
        id: "soldier_0",
        pos: { x: 0.5, y: 0.5 },
        state: UnitState.Idle,
      } as any,
    ],
    enemies: [
      {
        id: "enemy_0",
        type: "xeno-mite",
        pos: { x: 5.5, y: 5.5 },
      } as any
    ],
    visibleCells: ["0,0", "3,3", "5,5"],
    discoveredCells: ["0,0", "3,3", "5,5"],
    objectives: [
      {
        id: "obj_0",
        kind: "Recover",
        state: "Pending",
        visible: true,
        targetCell: { x: 2, y: 2 }
      } as any
    ],
    loot: [
      {
        id: "loot_0",
        itemId: "scrap_crate",
        pos: { x: 3, y: 3 }
      } as any
    ],
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
    squadInventory: { "scrap_crate": 1 },
  };

  beforeEach(() => {
    mockClient = { sendCommand: vi.fn() };
    controller = new MenuController(mockClient);
    controller.clearDiscoveryOrder();
  });

  it("should use friendly name for loot and objectives in TARGET_SELECT", () => {
    // Navigate to TARGET_SELECT (Pickup)
    controller.handleMenuInput("4", mockState); // Pickup

    const state = controller.getRenderableState(mockState);
    
    const objOption = state.options.find(
      (o) => o.key === "1"
    );
    expect(objOption?.label).toBe("1. Collect Objective");

    const lootOption = state.options.find(
      (o) => o.key === "2"
    );
    expect(lootOption?.label).toBe("2. Pickup Scrap Crate");
  });

  it("should use friendly name for inventory items in ITEM_SELECT", () => {
    // Navigate to ITEM_SELECT (Use Item)
    controller.handleMenuInput("3", mockState); // Use Item

    const state = controller.getRenderableState(mockState);
    const itemOption = state.options.find(
      (o) => o.label.includes("Scrap Crate"),
    );

    // This one might already be correct as per my previous check, but let's be sure
    expect(itemOption?.label).toBe("1. Scrap Crate (1)");
  });

  it("should use 'Name (N)' format for units in UNIT_SELECT", () => {
    // Navigate to UNIT_SELECT (Orders -> Hold)
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("5", mockState); // Hold -> UNIT_SELECT

    const state = controller.getRenderableState(mockState);
    const unitOption = state.options.find(
      (o) => o.dataAttributes?.["unit-id"] === "soldier_0",
    );

    expect(unitOption?.label).toBe("1. soldier_0 (1)");
  });

  it("should use 'Name (N)' format for friendly units in TARGET_SELECT", () => {
    // Navigate to TARGET_SELECT (Orders -> Escort)
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort -> TARGET_SELECT

    const state = controller.getRenderableState(mockState);
    const unitOption = state.options.find(
      (o) => o.dataAttributes?.index === "1",
    );

    expect(unitOption?.label).toBe("1. soldier_0 (1)");
  });
});

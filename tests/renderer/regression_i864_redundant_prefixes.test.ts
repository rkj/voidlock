import { describe, it, expect, beforeEach, vi } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, MissionType } from "@src/shared/types";

describe("Regression i864: Redundant Prefixes in Command Menu", () => {
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
        { x: 0, y: 0, type: 1, roomId: "room_1" },
        { x: 1, y: 0, type: 1, roomId: "room_2" },
      ] as any,
    },
    units: [
      {
        id: "soldier_0",
        pos: { x: 0.5, y: 0.5 },
        state: UnitState.Idle,
      } as any,
    ],
    enemies: [],
    visibleCells: ["0,0", "1,0"],
    discoveredCells: ["0,0", "1,0"],
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
      debugOverlayEnabled: false,
      debugSnapshots: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
      allowTacticalPause: true,
    },
    squadInventory: {},
  };

  beforeEach(() => {
    mockClient = { applyCommand: vi.fn() };
    controller = new MenuController(mockClient);
    controller.clearDiscoveryOrder();
  });

  it("should not have 'Unit' prefix in UNIT_SELECT labels", () => {
    // Navigate to UNIT_SELECT (Orders -> Hold)
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("5", mockState); // Hold -> UNIT_SELECT

    const state = controller.getRenderableState(mockState);
    const unitOption = state.options.find(
      (o) => o.dataAttributes?.["unit-id"] === "soldier_0",
    );

    expect(unitOption?.label).toBe("1. SOLDIER_0 (1)");
    // Currently it is "1. Unit soldier_0"
  });

  it("should not have 'Unit' prefix in TARGET_SELECT labels for FRIENDLY_UNIT", () => {
    // Navigate to TARGET_SELECT (Orders -> Escort)
    mockState.units[0].archetypeId = "vip";
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("4", mockState); // Escort -> TARGET_SELECT

    const state = controller.getRenderableState(mockState);
    const unitOption = state.options.find(
      (o) => o.dataAttributes?.index === "1",
    );

    expect(unitOption?.label).toBe("1. SOLDIER_0 (1)");
    // Currently it is "1. Unit soldier_0"
  });

  it("should have distinct room labels (e.g., 'Room 1') instead of just 'Room'", () => {
    // Navigate to TARGET_SELECT (Orders -> Move To Room)
    controller.handleMenuInput("1", mockState); // Orders
    controller.handleMenuInput("1", mockState); // Move To Room -> TARGET_SELECT

    const state = controller.getRenderableState(mockState);
    const room1Option = state.options.find(
      (o) => o.dataAttributes?.index === "1",
    );
    const room2Option = state.options.find(
      (o) => o.dataAttributes?.index === "2",
    );

    expect(room1Option?.label).toBe("1. ROOM 1");
    expect(room2Option?.label).toBe("2. ROOM 2");
    // Currently it is "1. Room" and "2. Room"
  });
});

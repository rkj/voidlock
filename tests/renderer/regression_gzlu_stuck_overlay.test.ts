import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { GameState, UnitState, MissionType } from "@src/shared/types";

describe("Regression voidlock-gzlu - Stuck Overlay on Back", () => {
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
        cells: [{ x: 5, y: 5, type: "Floor", roomId: "room1" } as any],
      },
      units: [
        {
          id: "u1",
          pos: { x: 0.5, y: 0.5 },
          state: UnitState.Idle,
          hp: 100,
          maxHp: 100,
        } as any,
      ],
      enemies: [],
      visibleCells: ["5,5"],
      discoveredCells: ["5,5"],
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
      applyCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should clear overlayOptions when backing out from TARGET_SELECT for Mine", () => {
    // 1. Action Select -> Use Item (3)
    controller.handleMenuInput("3", mockState);
    // 2. Item Select -> Landmine (1)
    controller.handleMenuInput("1", mockState);
    // 3. Unit Select -> Unit 1 (1)
    controller.handleMenuInput("1", mockState);

    expect(controller.menuState).toBe("TARGET_SELECT");

    // Refresh state to generate overlays
    controller.getRenderableState(mockState);
    expect(controller.overlayOptions.length).toBeGreaterThan(0);

    // 4. Go Back
    controller.goBack();
    expect(controller.menuState).toBe("UNIT_SELECT");

    // Verify overlayOptions is cleared
    expect(controller.overlayOptions).toEqual([]);
  });

  it("should clear overlayOptions when backing out from TARGET_SELECT for Move To", () => {
    // 1. Action Select -> Orders (1)
    controller.handleMenuInput("1", mockState);
    // 2. Orders Select -> Move To Room (1)
    controller.handleMenuInput("1", mockState);

    expect(controller.menuState).toBe("TARGET_SELECT");

    // Refresh state to generate overlays
    controller.getRenderableState(mockState);
    expect(controller.overlayOptions.length).toBeGreaterThan(0);

    // 3. Go Back
    controller.goBack();
    expect(controller.menuState).toBe("ORDERS_SELECT");

    // Verify overlayOptions is cleared
    expect(controller.overlayOptions).toEqual([]);
  });

  it("should clear overlayOptions when a target is selected in TARGET_SELECT", () => {
    // 1. Action Select -> Orders (1)
    controller.handleMenuInput("1", mockState);
    // 2. Orders Select -> Move To Room (1)
    controller.handleMenuInput("1", mockState);

    expect(controller.menuState).toBe("TARGET_SELECT");

    // Refresh state to generate overlays
    controller.getRenderableState(mockState);
    expect(controller.overlayOptions.length).toBeGreaterThan(0);

    // 3. Select a target (Room 1)
    controller.handleMenuInput("1", mockState);
    expect(controller.menuState).toBe("UNIT_SELECT");

    // Verify overlayOptions is cleared (currently it probably isn't)
    expect(controller.overlayOptions).toEqual([]);
  });
});

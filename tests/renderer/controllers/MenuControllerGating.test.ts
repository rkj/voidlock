/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "@src/renderer/MenuController";
import { CommandType, MissionType } from "@src/shared/types";

describe("MenuController Tutorial Gating", () => {
  let controller: MenuController;
  let mockTutorialManager: any;

  beforeEach(() => {
    controller = new MenuController({ applyCommand: vi.fn() });
    mockTutorialManager = {
      isActionAllowed: vi.fn().mockReturnValue(false),
    };
    controller.setTutorialManager(mockTutorialManager);
  });

  it("should allow transition to Orders menu even if child actions are blocked", () => {
    // Mock isActionAllowed to allow MOVE_TO (which makes Orders enabled in the check)
    // Wait! With my fix, TRANSITION is ALWAYS allowed.
    
    const gameState = {
      missionType: MissionType.Prologue,
      units: [],
      stats: {},
      map: { cells: [] },
      squadInventory: {}
    } as any;

    // Initially in ACTION_SELECT
    expect(controller.menuState).toBe("ACTION_SELECT");

    // Click Orders (key 1)
    controller.handleMenuInput("1", gameState);
    
    // Should have transitioned to ORDERS_SELECT
    expect(controller.menuState).toBe("ORDERS_SELECT");
  });

  it("should allow back navigation always", () => {
    const gameState = {} as any;
    
    // Transition to ORDERS_SELECT
    controller.handleMenuInput("1", gameState);
    expect(controller.menuState).toBe("ORDERS_SELECT");
    
    // Press Back (key 0)
    controller.handleMenuInput("0", gameState);
    expect(controller.menuState).toBe("ACTION_SELECT");
  });
});

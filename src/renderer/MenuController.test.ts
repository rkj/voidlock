import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuController } from "./MenuController";
import {
  CommandType,
  GameState,
  UnitState,
  CellType,
  EngagementPolicy,
} from "../shared/types";

describe("MenuController", () => {
  let controller: MenuController;
  let mockClient: any;
  const mockState: GameState = {
    t: 1000,
    map: { width: 10, height: 10, cells: [] },
    units: [
      { id: "u1", state: UnitState.Idle } as any,
      { id: "u2", state: UnitState.Idle } as any,
    ],
    enemies: [],
    visibleCells: [],
    discoveredCells: [],
    objectives: [],
    stats: {
      threatLevel: 0,
      aliensKilled: 0,
      casualties: 0,
    },
    status: "Playing",
    settings: {
      mode: "Simulation" as any,
      debugOverlayEnabled: false,
      losOverlayEnabled: false,
      timeScale: 1.0,
      isPaused: false,
      isSlowMotion: false,
    },
    squadInventory: {},
  };

  beforeEach(() => {
    mockClient = {
      sendCommand: vi.fn(),
    };
    controller = new MenuController(mockClient);
  });

  it("should start in ACTION_SELECT state", () => {
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should transition to MODE_SELECT when ENGAGEMENT (2) is selected", () => {
    controller.handleMenuInput("2", mockState);
    expect(controller.menuState).toBe("MODE_SELECT");
    expect(controller.pendingAction).toBe(CommandType.SET_ENGAGEMENT);
  });

  it("should transition to UNIT_SELECT when ENGAGE mode (1) is selected", () => {
    controller.handleMenuInput("2", mockState); // Select Action: Engagement
    controller.handleMenuInput("1", mockState); // Select Mode: Engage
    expect(controller.menuState).toBe("UNIT_SELECT");
    expect(controller.pendingMode).toBe("ENGAGE");
  });

  it("should send command when ALL UNITS are selected", () => {
    controller.handleMenuInput("2", mockState); // Action: Engagement
    controller.handleMenuInput("1", mockState); // Mode: Engage
    controller.handleMenuInput("3", mockState); // Units: All (1, 2, 3=All)

    expect(mockClient.sendCommand).toHaveBeenCalledWith({
      type: CommandType.SET_ENGAGEMENT,
      unitIds: ["u1", "u2"],
      mode: "ENGAGE",
      label: "Policy Change",
    });

    // Should reset
    expect(controller.menuState).toBe("ACTION_SELECT");
  });

  it("should support IGNORE mode", () => {
    controller.handleMenuInput("2", mockState); // Action
    controller.handleMenuInput("2", mockState); // Mode: Ignore
    controller.handleMenuInput("3", mockState); // All Units

    expect(mockClient.sendCommand).toHaveBeenCalledWith({
      type: CommandType.SET_ENGAGEMENT,
      unitIds: ["u1", "u2"],
      mode: "IGNORE",
      label: "Policy Change",
    });
  });

  it("should support canceling via goBack (ESC)", () => {
    controller.handleMenuInput("2", mockState);
    expect(controller.menuState).toBe("MODE_SELECT");
    controller.goBack();
    expect(controller.menuState).toBe("ACTION_SELECT");
    expect(controller.pendingAction).toBeNull();
  });

  it("should return correct renderable state for ACTION_SELECT", () => {
    const state = controller.getRenderableState(mockState);
    expect(state.title).toBe("ACTIONS");
    expect(state.options.length).toBeGreaterThan(0);
    expect(state.options[0].label).toContain("ORDERS");
  });

  it("should return correct renderable state for UNIT_SELECT", () => {
    controller.handleMenuInput("1", mockState); // ORDERS -> ORDERS_SELECT
    controller.handleMenuInput("4", mockState); // HOLD -> UNIT_SELECT
    const state = controller.getRenderableState(mockState);
    expect(state.title).toBe("SELECT UNIT(S)");
    // u1, u2, ALL, BACK = 4 options
    expect(state.options.length).toBe(4);
    expect(state.options[2].label).toContain("ALL UNITS");
    expect(state.options[3].isBack).toBe(true);
  });
});

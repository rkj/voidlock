// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InputManager } from "@src/renderer/InputManager";
import { GameState } from "@src/shared/types";

describe("InputManager Focus Handling", () => {
  let inputManager: InputManager;
  let mockScreenManager: any;
  let mockMenuController: any;
  let currentGameState: any;
  let cycleUnits: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="screen-mission"></div><canvas id="game-canvas"></canvas><button id="ui-btn">UI Button</button>';
    mockScreenManager = {
      getCurrentScreen: vi.fn(() => "mission"),
    };
    mockMenuController = {
      menuState: "ACTION_SELECT",
    };
    cycleUnits = vi.fn();
    currentGameState = vi.fn(() => ({ status: "Playing" } as GameState));

    inputManager = new InputManager({
      screenManager: mockScreenManager,
      menuController: mockMenuController,
      togglePause: vi.fn(),
      handleMenuInput: vi.fn(),
      abortMission: vi.fn(),
      onUnitDeselect: vi.fn(),
      handleCanvasClick: vi.fn(),
      onToggleDebug: vi.fn(),
      onToggleLos: vi.fn(),
      currentGameState,
      isDebriefing: () => false,
      getSelectedUnitId: vi.fn(() => null),
      onDeployUnit: vi.fn(),
      onUndeployUnit: vi.fn(),
      getCellCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
      getWorldCoordinates: vi.fn(() => ({ x: 0, y: 0 })),
      cycleUnits,
      panMap: vi.fn(),
      panMapBy: vi.fn(),
      zoomMap: vi.fn(),
    });
    inputManager.init();
  });

  afterEach(() => {
    inputManager.destroy();
  });

  it("should not trap focus when status is Playing", () => {
    currentGameState.mockReturnValue({ status: "Playing" } as GameState);
    expect(inputManager.trapsFocus).toBe(false);
  });

  it("should trap focus when status is Deployment", () => {
    currentGameState.mockReturnValue({ status: "Deployment" } as GameState);
    expect(inputManager.trapsFocus).toBe(true);
  });

  it("should allow default Tab behavior when UI element is focused", () => {
    const uiBtn = document.getElementById("ui-btn")!;
    uiBtn.focus();
    expect(document.activeElement).toBe(uiBtn);

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const handled = inputManager.handleKeyDown(event);

    expect(handled).toBe(false);
    expect(cycleUnits).not.toHaveBeenCalled();
  });

  it("should cycle units on Tab when no UI element is focused", () => {
    document.body.focus();
    expect(document.activeElement).toBe(document.body);

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const handled = inputManager.handleKeyDown(event);

    expect(handled).toBe(true);
    expect(cycleUnits).toHaveBeenCalled();
  });
});
